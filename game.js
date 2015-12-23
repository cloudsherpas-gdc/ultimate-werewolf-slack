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
    start: "`Minion`, wake up. `Werewolves`, stick out your thumb so the `Minion` can see who you are.",
    end: "`Werewolves`, put your thumbs away. `Minion`, close your eyes.",
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

  constructor(slackClient, channel, players) {
    this.client = slackClient;
    this.channel = channel;
    this.players = [];
    this.playerNames = [];
    this.roles = [];
    this.origAssignments = {};
    this.assignments = {};
    this.gameID = Math.random().toString(36).substr(2, 5);
    // TODO: Add tracking and checking for current turns and corresponding actions
    this.currentTurn = 'Beginning';

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
        let members = data[entity].members;
        if (players.length) {
          let listedPlayers = players.map(p => p.substring(2, p.length - 1));
          if (!listedPlayers.every( v => members.indexOf(v) > -1 )) {
            this.client.sendMsg(channel, "Not everyone is in the room. Please type `!w force-end` to force the game to end.");
            return;
          }
          members = listedPlayers;
        }
        this.getPlayers(members);
        this.announceRoles();
        this.delegateRoles();
        this.announcePlayerRole();
        // We're ready to start the night!
        this.asyncDelay(this.startNight);
      }).bind(this));
  }

  getPlayers(channelMembers) {
    console.log(channelMembers);
    // get the players
    this.players = channelMembers.slice();
    let idx = this.players.indexOf(this.client.slackData.self.id);
    if (idx > -1) this.players.splice(idx, 1);
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
    this.playerNames.forEach(
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
    // Role not included in the game
    if (this.roles.indexOf(role) === -1)
      return Promise.resolve();

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
        let playersThisTurn = this.filterPlayersByRole(role);
        if (playersThisTurn.length) {
          playersThisTurn.forEach(
            (function(k) {
              this.sendPMInGame(this.origAssignments[k].id, "Your turn...");
              this.executePlayerTurn(this.origAssignments[k]);
            }).bind(this));
        }
        else {
          setTimeout((function() {
            this.nextStep();
          }).bind(this), ((Math.random() * 2.5) + 5) * 1000);
        }
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
        this.sendPMInGame(player.id, "You are the only werewolf, center peek: `" + this.roles[center_idx] + "`");
      }
      this.nextStep();
    }

    else if (player.role == 'Minion') {
      let werewolves = this.filterPlayersByRole('Werewolf');
      this.sendPMInGame(player.id, "Werewolves: " + werewolves.join(' & '));
      this.nextStep();
    }

    else if (player.role == 'Seer') {
      this.sendPMInGame(player.id, "`!w peek-" + this.gameID + " center` to peek at 2 center cards or `!w peek-" + this.gameID + " @username` to peek at a player's card");
      // TODO: Add time limit
    }

    else if (player.role == 'Robber') {
      this.sendPMInGame(player.id, "`!w rob-" + this.gameID + " @username` to rob a player");
      // TODO: Add time limit
    }

    else if (player.role == 'Troublemaker') {
      this.sendPMInGame(player.id, "`!w swap-" + this.gameID + " @userA @userB` to swap the players' cards");
      // TODO: Add time limit
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
      let senderIdx = this.players.indexOf(sender);
      let announce = this.playerNames[senderIdx] + " is trying to be a Seer!";
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
        this.sendPMInGame(sender, "There are no players with that username: " + targetName);
        return;
      }
      this.sendPMInGame(sender, targetName + "'s role is `" + this.assignments[targetName].role + "`");
    }
    this.nextStep();
  }

  robberRob(sender, target) {
    // role check
    let robber = this.filterPlayersByOriginalRole('Robber');
    if (!robber.length) {
      this.sendPMInGame(sender, "But you're not a Robber!");
      let senderIdx = this.players.indexOf(sender);
      let announce = this.playerNames[senderIdx] + " is trying to be a Robber!";
      this.client.sendMsg(this.channel, announce);
      return;
    }

    let targetName = target.slice(1);
    if (!this.assignments.hasOwnProperty(targetName)) {
      this.sendPMInGame(sender, "There are no players with that username: " + targetName);
      return;
    }
    let senderIdx = this.players.indexOf(sender);
    let senderName = this.playerNames[senderIdx];
    let oldRole = this.assignments[senderName].role;
    let newRole = this.assignments[targetName].role;
    this.assignments[senderName].role = newRole;
    this.assignments[targetName].role = oldRole;
    this.sendPMInGame(sender, "Your new role is `" + newRole + "`");
    this.nextStep();
  }

  troublemakerSwap(sender, target1, target2) {
    // role check
    let troublemaker = this.filterPlayersByOriginalRole('Troublemaker');
    if (!troublemaker.length) {
      this.sendPMInGame(sender, "But you're not a Troublemaker!");
      let senderIdx = this.players.indexOf(sender);
      let announce = this.playerNames[senderIdx] + " is trying to be a Troublemaker!";
      this.client.sendMsg(this.channel, announce);
      return;
    }

    let targetName1 = target1.slice(1);
    if (!this.assignments.hasOwnProperty(targetName1)) {
      this.sendPMInGame(sender, "There are no players with that username: " + targetName1);
      return;
    }
    let targetName2 = target2.slice(1);
    if (!this.assignments.hasOwnProperty(targetName2)) {
      this.sendPMInGame(sender, "There are no players with that username: " + targetName2);
      return;
    }
    let role1 = this.assignments[targetName1].role;
    let role2 = this.assignments[targetName2].role;
    this.assignments[targetName1].role = role2;
    this.assignments[targetName2].role = role1;
    this.sendPMInGame(sender, "You swapped their cards");
    this.nextStep();
  }

  lynchingVote(sender, target) {
    // TODO: implementation
  }

  forceEnd() {
    this.client.sendMsg(this.channel, "_Game was forced to end_");
    this.currentTurn = 'Complete';
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
