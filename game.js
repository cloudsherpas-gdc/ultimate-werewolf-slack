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

const MESSAGES = {
  'Game': {
    start: "Everyone, close your eyes.",
    end: "Wake up!",
  },
  'Werewolf': {
    start: "`Werewolves`, wake up and look for other werewolves.",
    end: "`Werewolves`, close your eyes.",
  },
  'Minion': {
    start: "`Minion`, wake up. Werewolves, <no need to actually do this> stick out your thumb so the Minion can see who you are.",
    end: "Werewolves, put your thumbs away <duh>. `Minion`, close your eyes.",
  },
  'Seer': {
    start: "`Seer`, wake up. You may look at another player's card or two of the center cards.",
    end: "`Seer`, close your eyes.",
  },
  'Robber': {
    start: "`Robber`, wake up. You may exchange your card with another player's card, and then view your new card.",
    end: "`Robber`, close your eyes.",
  },
  'Troublemaker': {
    start: "`Troublemaker`, wake up. You may exchange cards between two other players.",
    end: "`Troublemaker`, close your eyes.",
  },
  'Drunk': {
    start: "`Drunk`, wake up and exchange your card with a card from the center.",
    end: "`Drunk`, close your eyes.",
  },
  'Insomniac': {
    start: "`Insomniac`, wake up and look at your card",
    end: "`Insomniac`, close your eyes.",
  },
};

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
    this.asyncDelay(this.sendStartMessage, 'Game')
      // .then(this.wakeUp('Werewolf'))
      // .then(this.wakeUp('Minion'))
      // .then(this.wakeUp('Seer'))
      // .then(this.wakeUp('Robber'))
      // .then(this.wakeUp('Troublemaker'))
      // .then(this.wakeUp('Drunk'))
      // .then(this.wakeUp('Insomniac'))
      .then(this.asyncDelay(this.sendEndMessage, 'Game'));
  }

  wakeUp(role) {
    return this.asyncDelay(this.sendStartMessage, role)
            .then(this.initiateRoleSequence(role))
            .then(this.asyncDelay(this.sendEndMessage, role));
  }

  sendStartMessage(role) {
    this.client.sendMsg(this.channel, MESSAGES[role].start);
  }

  initiateRoleSequence(role) {
    return new Promise((function(resolve, reject) {
        this.filterPlayersByRole(role).forEach(
            k => this.client.sendPM(
                    this.assignments[k].id,
                    "[`" + this.gameID + "`] Your turn..."
                  )
          );
        resolve();
      }).bind(this));
  }

  sendEndMessage(role) {
    this.client.sendMsg(this.channel, MESSAGES[role].end);
  }

  filterPlayersByRole(role) {
    return Object.keys(this.assignments).filter(
        k => role === this.assignments[k].role
      );
  }

  forceEnd() {
    //
  }

  asyncDelay(fn) {
    let args = Array.prototype.slice.call(arguments, this.asyncDelay.length);
    return new Promise((function(resolve, reject) {
        setTimeout((function() {
          fn.apply(this, args);
          resolve();
        }).bind(this), ((Math.random() * 2.5) + 5) * 1000);
      }).bind(this));
  }

}

function shuffle(o) {
  for(var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
  return o;
}

module.exports = Game;
