'use strict';

var hex = hex || {};

hex.controls = (function dataSimulator(d3, Rx) {

  Rx.Observable.fromEvent(d3.select('#push-doodles').node(), 'click').subscribe(function() {
    var xhr = d3.xhr('/api/doodle/random/10', function(err, res) {
      console.log(err || res);
    });
  });

  var winnerSocket = Rx.DOM.fromWebSocket(d3demo.config.backend.ws + '/winner');
  winnerSocket.subscribeOnError(function(err) {
    console.log(err.stack || err);
  });

  // keyboard controls
  var keyboardSubscription = Rx.Observable.fromEvent(document.getElementsByTagName('body')[0], 'keyup')
  .filter(function(event) {
    return [37, 38, 39, 40, 13].some(function(keyCode) {
      return keyCode == event.keyCode;
    });
  })
  .tap(function(event) {
    var newId;
    var pushButton = document.getElementById('push-doodles');
    if (pushButton && pushButton === document.activeElement) {
      pushButton.blur();
    }
    switch(event.keyCode) {
      case 37: // LEFT
      winnerSocket.onNext(JSON.stringify({key: 'test', msg: 'left'}));
        break;
      case 38: // UP
        winnerSocket.onNext(JSON.stringify({key: 'test', msg: 'up'}));
        break;
      case 39: // RIGHT
        winnerSocket.onNext(JSON.stringify({key: 'test', msg: 'right'}));
        break;
      case 40: // DOWN
        winnerSocket.onNext(JSON.stringify({key: 'test', msg: 'down'}));
        break;
      case 13: // ENTER
        winnerSocket.onNext(JSON.stringify({key: 'test', msg: 'pick'}));
        break;
    };
  })
  .subscribeOnError(hex.errorObserver);

  // websocket controls
  var websocketSubscription = hex.messages.filter(function(message) {
    return message.type === 'winner';
  }).tap(function(message) {
    var doodlesPresent = hex.points.some(function(point) {
      return !! point.doodle;
    });
    if (! doodlesPresent) {
      return;
    }
    var action = message.data;
    console.log('Winner action: ', action);
    var newId;
    switch (action) {
      case 'left':
        newId = hex.highlight.moveHighlightHorizontally(-1);
        console.log(newId);
        hex.highlight.highlight(newId);
        break;
      case 'right':
        newId = hex.highlight.moveHighlightHorizontally(1);
        console.log(newId);
        hex.highlight.highlight(newId);
        break;
      case 'up':
        newId = hex.highlight.moveHighlightVertically(-1);
        console.log(newId);
        hex.highlight.highlight(newId);
        break;
      case 'down':
        newId = hex.highlight.moveHighlightVertically(1);
        console.log(newId);
        hex.highlight.highlight(newId);
        break;
      case 'pick':
        hex.winner.pickWinner();
        break;
    };
  }).subscribeOnError(hex.errorObserver);

  // mouse controls
  var lastDoodle;
  var mouseSubscription = Rx.Observable.fromEvent(document.querySelector('.map'), 'mousemove')
  .filter(function(event) {
    return event.target.classList.contains('doodle');
  })
  .tap(function(event) {
    var p = d3.select(event.target).datum();
    if (lastDoodle === p || hex.winner.isAlreadyWinner(p)) {
      return;
    };
    var newId = p.id;
    console.log('highlighting ', newId);
    hex.highlight.highlight(newId);
  })
  .subscribeOnError(hex.errorObserver);

  Rx.Observable.fromEvent(document.querySelector('.map'), 'click')
  .filter(function(event) {
    return event.target.classList.contains('highlight');
  })
  .tap(function(event) {
    var p = d3.select(event.target).datum();
    var newId = p.id;
    console.log('picking ', newId);
    hex.winner.pickWinner(newId);
  })
  .subscribeOnError(hex.errorObserver);

  var dispose = function() {
    keyboardSubscription.dispose();
    websocketSubscription.dispose();
    mouseSubscription.dispose();
  };

  return {
    dispose: dispose
  }

})(d3, Rx);
