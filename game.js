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
    start: "*Everyone, close your eyes.*",
    end: "*Wake up!* Voting ends in 5 minutes...",
  },
  'Werewolf': {
    start: "`Werewolves`, wake up and look for other werewolves.",
    end: "`Werewolves`, close your eyes.",
  },
  'Minion': {
    start: "`Minion`, wake up. `Werewolves`, <no need to actually do this> stick out your thumb so the `Minion` can see who you are.",
    end: "`Werewolves`, put your thumbs away <duh>. `Minion`, close your eyes.",
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
    this.origAssignments = {};
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
        this.asyncDelay(this.startNight);
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
      (n, i) => this.origAssignments[n] = {id: this.players[i], role: this.roles[i]}
    );
    this.assignments = Object.assign({}, this.origAssignments);
  }

  announcePlayerRole() {
    // send out the roles via PM
    Object.keys(this.origAssignments).forEach(
        k => this.client.sendPM(
                this.origAssignments[k].id,
                "[`" + this.gameID + "`] Your role is `" + this.origAssignments[k].role + "`!"
              )
      );
  }

  startNight() {
    return this.asyncDelay(this.sendStartMessage, 'Game')
            .then((function(){return this.wakeUp('Werewolf');}).bind(this))
            .then((function(){return this.wakeUp('Minion');}).bind(this))
            .then((function(){return this.wakeUp('Seer');}).bind(this))
            .then((function(){return this.wakeUp('Robber');}).bind(this))
            .then((function(){return this.wakeUp('Troublemaker');}).bind(this))
            .then((function(){return this.wakeUp('Drunk');}).bind(this))
            .then((function(){return this.wakeUp('Insomniac');}).bind(this))
            .then((function(){return this.asyncDelay(this.sendEndMessage, 'Game');}).bind(this));
  }

  wakeUp(role) {
    return this.asyncDelay(this.sendStartMessage, role)
            .then((function(){return this.initiateRoleSequence(role);}).bind(this))
            .then((function(){return this.asyncDelay(this.sendEndMessage, role);}).bind(this));
  }

  sendStartMessage(role) {
    this.client.sendMsg(this.channel, MESSAGES[role].start);
  }

  sendEndMessage(role) {
    this.client.sendMsg(this.channel, MESSAGES[role].end);
  }

  initiateRoleSequence(role) {
    return new Promise((function(resolve, reject) {
        this.nextStep = resolve;
        this.filterPlayersByRole(role).forEach(
          (function(k) {
            this.sendPMInGame(this.origAssignments[k].id, "Your turn...");
            this.executePlayerTurn(this.origAssignments[k]);
          }).bind(this));
      }).bind(this));
  }

  filterPlayersByOriginalRole(role) {
    return Object.keys(this.origAssignments).filter(
        k => role === this.origAssignments[k].role
      );
  }

  filterPlayersByRole(role) {
    return Object.keys(this.assignments).filter(
        k => role === this.assignments[k].role
      );
  }

  sendPMInGame(recipient, message) {
    this.client.sendPM(recipient, "[`" + this.gameID + "`] " + message);
  }

  executePlayerTurn(player) {
    if (player.role == 'Werewolf') {
      let werewolves = this.filterPlayersByRole('Werewolf');
      if (werewolves.length > 1) {
        // give a list of werewolves
        this.sendPMInGame(player.id, "Werewolves: " + werewolves.join(' & '));
      }
      else {
        // peek at center
        let center_idx = Math.floor(Math.random() * 3) + this.players.length;
        this.sendPMInGame(player.id, "Center peek: `" + this.roles[center_idx] + "`");
      }
      this.nextStep();
    }

    else if (player.role == 'Minion') {
      let werewolves = this.filterPlayersByRole('Werewolf');
      this.sendPMInGame(player.id, "Werewolves: " + werewolves.join(' & '));
      this.nextStep();
    }

    else if (player.role == 'Seer') {
      this.sendPMInGame(player.id, "`!w peek center` to peek at 2 center cards or `!w peek @username` to peek at a player's card");
    }

    else if (player.role == 'Robber') {
      this.sendPMInGame(player.id, "`!w rob @username` to rob a player");
    }

    else if (player.role == 'Troublemaker') {
      this.sendPMInGame(player.id, "`!w swap @userA @userB` to swap the players' cards");
    }

    else if (player.role == 'Drunk') {
      this.sendPMInGame(player.id, "Your card's swapped to center");
      this.nextStep();
    }

    else if (player.role == 'Insomniac') {
      this.sendPMInGame(player.id, "Your card is...");
      this.nextStep();
    }
  }

  seerPeek(sender, target) {
    // role check
    let seer = this.filterPlayersByOriginalRole('Seer');
    if (!seer.length) {
      this.sendPMInGame(sender, "But you're not a Seer!");
      let playerIdx = this.players.indexOf(sender);
      let announce = this.playerNames[playerIdx] + " is trying to be a Seer!";
      this.client.sendMsg(this.channel, announce);
      return;
    }

    // peek 2 cards center
    if (target == 'center') {
      let center_idx1 = -1;
      let center_idx2 = -1;
      do {
        center_idx1 = Math.floor(Math.random() * 3) + this.players.length;
        center_idx2 = Math.floor(Math.random() * 3) + this.players.length;
      } while (center_idx1 == center_idx2);
      this.sendPMInGame(sender, "Center peek: `" + this.roles[center_idx1] + "`, `" + this.roles[center_idx2] + "`");
    }

    // peek player card
    else {
      let targetName = target.slice(1);
      if (!this.assignments.hasOwnProperty(targetName)) {
        this.sendPMInGame(sender, "There are no players with that username");
        return;
      }
      this.sendPMInGame(sender, targetName + "'s role is `" + this.assignments[targetName].role + "`");
    }
    this.nextStep();
  }

  robberRob() {
    // role check
    let robber = this.filterPlayersByOriginalRole('Robber');
    if (!robber.length) {
      this.sendPMInGame(sender, "But you're not a Robber!");
      let playerIdx = this.players.indexOf(sender);
      let announce = this.playerNames[playerIdx] + " is trying to be a Robber!";
      this.client.sendMsg(this.channel, announce);
      return;
    }
  }

  troublemakerSwap() {
    // role check
    let troublemaker = this.filterPlayersByOriginalRole('Troublemaker');
    if (!troublemaker.length) {
      this.sendPMInGame(sender, "But you're not a Troublemaker!");
      let playerIdx = this.players.indexOf(sender);
      let announce = this.playerNames[playerIdx] + " is trying to be a Troublemaker!";
      this.client.sendMsg(this.channel, announce);
      return;
    }
  }

  lynchingVote() {
    //
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
