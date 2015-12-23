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
      clearTimeout(games[channel].timeLimit);
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
      clearTimeout(games[channel].timeLimit);
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
      clearTimeout(games[channel].timeLimit);
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
      var helpMessage = ""
        + "• Anyone can chat `!w start` in a channel to start a new game. There can only be one game in-progress per channel.\n"
        + "• You can also specify players by chatting `!w start @user1 @user2 ...`, up to 8 players in total\n"
        + "• A Seer can PM the <@" + slack.slackData.self.id + "> `!w peek-gameid center` to peek at 2 random center cards or `!w peek @user` to peek at a player's card\n"
        + "• A Robber can PM the <@" + slack.slackData.self.id + "> `!w rob-gameid @user` to rob a user\n"
        + "• A Troublemaker can PM the <@" + slack.slackData.self.id + "> `!w swap-gameid @user1 @user2` to swap @user1 and @user2's cards\n"
        + "• Anyone can chat `!w vote @user` to vote who will be lynched\n"
        + "• Anyone can chat `!w force-end` to end a game prematurely\n"
        + "• Typing `!w help` will show this help message";
       slack.sendMsg(channel, helpMessage);
    }
  }
});
