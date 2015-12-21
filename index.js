var slackAPI = require('slackbotapi');

var token = '' || process.env.SLACK_API_TOKEN;

var CMD_PREFIX = '!w';
var ROLES = [
  'Werewolf',
  'Werewolf', // 2 werewolves
  'Minion',
  'Seer',
  'Robber',
  'Troublemaker',
  'Drunk',
  'Insomniac',
  'Villager',
  'Villager',
  'Villager',
];


var slack = new slackAPI({
    'token': token,
    'logging': true,
    'autoReconnect': true
});

slack.on('message', function (message) {
  if (message.text.startsWith(CMD_PREFIX + ' ')) {
    var parts = message.text.split(' ');
    var command = parts[1];
    var args = parts.slice(2);

    if (command == 'start') {

      if (message.channel.startsWith('C')) {
        slack.reqAPI('channels.info', {channel: message.channel}, function (data) {
          var players = data.channel.members.slice();
          var idx = players.indexOf(slack.slackData.self.id);
          players.splice(idx, 1);
          players.map(function(userID) {
            slack.sendPM(userID, 'hello! ' + message.ts);
          });
        });
      }
      else if (message.channel.startsWith('G')) {
        slack.reqAPI('groups.info', {channel: message.channel}, function (data) {
          var players = data.group.members.slice();
          var idx = players.indexOf(slack.slackData.self.id);
          players.splice(idx, 1);
          players.map(function(userID) {
            slack.sendPM(userID, 'hello! ' + message.ts);
          });
        });
      }
      else if (message.channel.startsWith('D')) {
        console.log(message.text);
      }

    }
  }
});
