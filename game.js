'use strict';

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

class Game {

  constructor(slackClient, channel) {
    this.client = slackClient;
    this.channel = channel;

    var method, entity;
    if (this.channel.startsWith('C')) {
      method = 'channels.info';
      entity = 'channel';
    }
    else if (this.channel.startsWith('G')) {
      method = 'groups.info';
      entity = 'group';
    }
    // TODO: problematic! we need this.players on instance creation but this is async
    this.client.reqAPI(method, {channel: this.channel},
      (function(data) {
        this.players = data[entity].members.slice();
        var idx = this.players.indexOf(this.client.slackData.self.id);
        this.players.splice(idx, 1);
      }).bind(this));
  }

  sendRoles() {
    this.players.map(function(userID) {
      this.client.sendPM(userID, 'hello!!!');
    });
  }

}

module.exports = Game;
