'use strict';

const ROLES = [
  'Werewolf',
  'Werewolf',
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
    this.players = [];
    this.playerNames = [];
    this.roles = [];
    this.assignments = {};
    this.gameID = Math.random().toString(36).substr(2, 5);

    // announce GameID
    let announce = "A new game of *Ultimate Werewolf*, GameID `" + this.gameID + "`";
    this.client.sendMsg(this.channel, announce);

    let method, entity;
    if (this.channel.startsWith('C')) {
      method = 'channels.info';
      entity = 'channel';
    }
    else if (this.channel.startsWith('G')) {
      method = 'groups.info';
      entity = 'group';
    }
    this.client.reqAPI(method, {channel: this.channel},
      (function(data) {
        this.getPlayers(data[entity].members);
        this.announceRoles();
        this.delegateRoles();
        this.announcePlayerRole();
        // We're ready to start the night!
        this.startNight();
      }).bind(this));
  }

  getPlayers(channelMembers) {
    // get the players
    this.players = channelMembers.slice();
    let idx = this.players.indexOf(this.client.slackData.self.id);
    this.players.splice(idx, 1);
    // limit players to # of roles
    this.players = this.players.slice(0, ROLES.length);
    this.playerNames = this.players.slice().map(p => this.client.getUser(p).name);
    let announce = 'The players (' + this.players.length + '): @' + this.playerNames.join(', @');
    this.client.sendMsg(this.channel, announce);
  }

  announceRoles() {
    // announce roles to all players
    this.roles = ROLES.slice(0, this.players.length + 3);
    let announce = 'The roles: `' + this.roles.join('`, `') + '`';
    this.client.sendMsg(this.channel, announce);
  }

  delegateRoles() {
    shuffle(this.roles);
    this.players.forEach(
      (n, i) => this.assignments[n] = {id: this.players[i], role: this.roles[i]}
    );
  }

  announcePlayerRole() {
    // send out the roles via PM
    Object.keys(this.assignments).forEach(
        k => this.client.sendPM(
                this.assignments[k].id,
                "[`" + this.gameID + "`] Your role is `" + this.assignments[k].role + "`!"
              )
      );
  }

  startNight() {
    //
  }

  forceEnd() {
    //
  }

}

function shuffle(o) {
  for(var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
  return o;
}

module.exports = Game;
