var Rx = require('rx')
  , RxNode = require('rx-node')
  , split = require('split')
  , fs = require('fs')
  , sort = require('sort-stream2')
  , filter = require('stream-filter')
  , through2 = require('through2')
  , parseData = require('./pod').parseData
  ;

var tag = 'PLAYBACK';

// Read, parse, and sort the pod evetns from a file
var fileStream = fs.createReadStream('./pods-create.log')
  .pipe(split())
  .pipe(filter(function(data) {
    return data.length > 0;
  }))
  .pipe(through2.obj(function (chunk, enc, callback) {
    var event = parseData(JSON.parse(chunk))
    this.push(event);
    callback()
  }))
  .pipe(filter(function(parsed) {
    return parsed && parsed.data && parsed.data.stage;
  }))
  .pipe(sort(function(a, b) {
    return a.data.creationTimestamp.getTime() - b.data.creationTimestamp.getTime();
  }));

var logEvents = RxNode.fromStream(fileStream).share();

var startTime = null;
var previousInterval = null;
var interval = 1000; //ms

// An observable triggerred by <interval> changes in logEvents
var replayProgress = logEvents.flatMap(function(event) {
  var timestamp = event.data.creationTimestamp.getTime(); // ms
  (!startTime) && (startTime = timestamp);
  var scanInterval = Math.floor((timestamp - startTime) / interval);
  (!previousInterval) && (previousInterval == scanInterval - 1);
  var gap = scanInterval - previousInterval;
  var sequence = (gap <= 1) ? [scanInterval] : Rx.Observable.range(previousInterval + 1, gap); // trigger on empty seconds
  previousInterval = scanInterval;
  return sequence;
})
.distinctUntilChanged()
.map(function(scanInterval) {
  return scanInterval;
}).share();

// buffer the events by <interval>
var bufferedEvents = logEvents.buffer(replayProgress, function() {return replayProgress});

// Zip the buffered events to an interval for real-time playback
var replay = Rx.Observable.zip(
  bufferedEvents
, Rx.Observable.interval(interval) // ms
, function(podEvents, index) { return podEvents}
)
.flatMap(function(podEvents) {
  return podEvents;
})
.map(function(parsed) {
  return parsed.data;
});

module.exports = {
  events: function() {
    return replay;
  }
};
