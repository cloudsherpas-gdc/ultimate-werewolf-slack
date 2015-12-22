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
      if (!channel.startsWith('C') && !channel.startsWith('G')) {
        slack.sendMsg(channel, "You can't do this through PM");
        return;
      }
      if (games.hasOwnProperty(channel)) {
        slack.sendMsg(channel, "A game is already in progress...");
        return;
      }

      try {
        games[channel] = new Game(slack, channel, args);
      }
      catch (e) {
        slack.sendMsg(channel, e);
        delete games[channel];
      }
    }

    else if (command == 'peek') {
      if (!channel.startsWith('D')) {
        slack.sendMsg(channel, "You just can't peek at cards blatantly");
        return;
      }
      // FIXME: get REAL channel
      games[channel].seerPeek(message.user, args[0]);
    }

    else if (command == 'rob') {
      if (!channel.startsWith('D')) {
        slack.sendMsg(channel, "Please don't cause trouble");
        return;
      }
      // FIXME: get REAL channel
      games[channel].robberRob(message.user, args[0]);
    }

    else if (command == 'swap') {
      if (!channel.startsWith('D')) {
        slack.sendMsg(channel, "Please don't cause trouble");
        return;
      }
      // FIXME: get REAL channel
      games[channel].troublemakerSwap(message.user, args[0], args[1]);
    }

    else if (command == 'vote') {
      if (!channel.startsWith('C') && !channel.startsWith('G')) {
        slack.sendMsg(channel, "You can't do this through PM");
        return;
      }
    }

    else if (command == 'end') {
      if (!channel.startsWith('C') && !channel.startsWith('G')) {
        slack.sendMsg(channel, "You can't do this through PM");
        return;
      }
      if (!games.hasOwnProperty(channel)) {
        slack.sendMsg(channel, "Can't find a game to end...");
        return;
      }
      games[channel].forceEnd();
    }

    else if (command == 'help') {
      //
    }
  }
});
