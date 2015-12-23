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
var registry = {};

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
      if (games.hasOwnProperty(channel) && games[channel].currentTurn != 'End') {
        slack.sendMsg(channel, "A game is already in progress...");
        return;
      }
      games[channel] = new Game(slack, channel, args);
      registry[games[channel].gameID] = channel;
    }

    else if (command.startsWith('peek')) {
      if (!channel.startsWith('D')) {
        slack.sendMsg(channel, "You just can't peek at cards blatantly");
        return;
      }
      var gameID = command.split('-')[1];
      if (!registry.hasOwnProperty(gameID)) {
        slack.sendMsg(channel, "Can't find a game to do this action...");
        return;
      }
      channel = registry[gameID];
      games[channel].seerPeek(message.user, args[0]);
    }

    else if (command.startsWith('rob')) {
      if (!channel.startsWith('D')) {
        slack.sendMsg(channel, "Please don't cause trouble");
        return;
      }
      var gameID = command.split('-')[1];
      if (!registry.hasOwnProperty(gameID)) {
        slack.sendMsg(channel, "Can't find a game to do this action...");
        return;
      }
      channel = registry[gameID];
      games[channel].robberRob(message.user, args[0]);
    }

    else if (command.startsWith('swap')) {
      if (!channel.startsWith('D')) {
        slack.sendMsg(channel, "Please don't cause trouble");
        return;
      }
      var gameID = command.split('-')[1];
      if (!registry.hasOwnProperty(gameID)) {
        slack.sendMsg(channel, "Can't find a game to do this action...");
        return;
      }
      channel = registry[gameID];
      games[channel].troublemakerSwap(message.user, args[0], args[1]);
    }

    else if (command == 'vote') {
      if (!channel.startsWith('C') && !channel.startsWith('G')) {
        slack.sendMsg(channel, "You can't do this through PM");
        return;
      }
      games[channel].lynchingVote(message.user, args[0]);
    }

    else if (command == 'force-end') {
      if (!channel.startsWith('C') && !channel.startsWith('G')) {
        slack.sendMsg(channel, "You can't do this through PM");
        return;
      }
      if (!games.hasOwnProperty(channel)) {
        slack.sendMsg(channel, "Can't find a game to end...");
        return;
      }
      games[channel].forceEnd();
      delete games[channel];
    }

    else if (command == 'help') {
      //
    }
  }
});

// polyfill: getGroup()

slackAPI.prototype.getGroup = function (term) {
    var group = null,
        self = this;
    for (var i in self.slackData.groups) {
        if (self.slackData.groups[i].name === term) {
            group = self.slackData.groups[i];
        }
    }
    if (group === null) {
        for (var i_ in self.slackData.groups) {
            if (self.slackData.groups[i_].id === term) {
                group = self.slackData.groups[i_];
            }
        }
    }
    return group;
};
