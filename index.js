var slackAPI = require('slackbotapi');
var Game = require('./game');

var CMD_PREFIX = '!w';

var token = '' || process.env.SLACK_API_TOKEN;

var slack = new slackAPI({
    'token': token,
    'logging': true,
    'autoReconnect': true
});

var games = {};

slack.on('message', function (message) {
  if (message.text.startsWith(CMD_PREFIX + ' ')) {
    var channel = message.channel;
    var parts = message.text.split(' ');
    var command = parts[1];
    var args = parts.slice(2);

    if (command == 'start') {
      if (games.hasOwnProperty(channel)) {
        slack.sendMsg(channel, "A game is already in progress...");
        return;
      }
      games[channel] = new Game(slack, channel);
      // else if (channel.startsWith('D')) {
      //   console.log(message.text);
      // }
    }

    else if (command == 'peek') {
      //
    }

    else if (command == 'rob') {
      //
    }

    else if (command == 'swap') {
      //
    }

    else if (command == 'vote') {
      //
    }

    else if (command == 'end') {
      if (!games.hasOwnProperty(channel)) {
        slack.sendMsg(channel, "Can't find a game to end...");
        return;
      }
      games[channel].forceEnd();
    }
  }
});
