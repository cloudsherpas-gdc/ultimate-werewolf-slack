'use strict';

const TIME_LIMIT = 15000;
const VOTING_PHASE = 5; // minutes
const REMINDERS = [60000, 120000, 180000, 240000, 270000];

const DECK = [
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
    end: "*Wake up!* Voting ends in " + VOTING_PHASE + " minutes. Type `!w vote @username` to vote.",
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

function randomDelay() {
  return ((Math.random() * 2.5) + 5) * 1000;
}

class Game {

  constructor(slackClient, channel, players) {
    this.gameID = Math.random().toString(36).substr(2, 5);
    this.client = slackClient;
    this.channel = channel;
    this.currentTurn = 'Beginning';
    this.players = [];
    this.roleDeck = [];
    this.origRoles = {};
    this.roles = {};
    this.nextStep = Promise.resolve;
    this.timeLimit = null;
    this.votes = {};
    this.tally = {};

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
          if (!listedPlayers.every( v => members.indexOf(v) >= 0 )) {
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
    // get the players
    this.players = channelMembers.slice();
    // remove @werewolf-mod
    let idx = this.players.indexOf(this.client.slackData.self.id);
    if (idx >= 0) this.players.splice(idx, 1);
    // limit players to # of roles
    this.players = this.players.slice(0, DECK.length);
    let announce = 'The players (' + this.players.length + '): <@' + this.players.join('>, <@') + ">";
    this.client.sendMsg(this.channel, announce);
  }

  announceRoles() {
    // announce roles to all players
    this.roleDeck = DECK.slice(0, this.players.length + 3);
    let announce = 'The roles: `' + this.roleDeck.join('`, `') + '`';
    this.client.sendMsg(this.channel, announce);
  }

  delegateRoles() {
    shuffle(this.roleDeck);
    this.players.forEach(
      (player, i) => this.origRoles[player] = this.roleDeck[i]
    );
    this.roles = Object.assign({}, this.origRoles);
  }

  announcePlayerRole() {
    // send out the roles via PM
    Object.keys(this.origRoles).forEach(
      player => this.sendPMInGame(player, "Your role is `" + this.origRoles[player] + "`!"));
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
            .then((function(){return this.asyncDelay(this.sendEndMessage, 'Game');}).bind(this))
            .then((function(){return this.beginVoting();}).bind(this))
  }

  wakeUp(role) {
    this.currentTurn = role + "'s turn";

    // Role not included in the game
    if (this.roleDeck.indexOf(role) < 0)
      return Promise.resolve();

    return this.asyncDelay(this.sendStartMessage, role)
            .then((function(){return this.initiateRoleSequence(role);}).bind(this))
            .then((function(){return this.asyncDelay(this.sendEndMessage, role);}).bind(this));
  }

  beginVoting() {
    this.currentTurn = 'Voting Phase';
    setTimeout((function() {
      this.client.sendMsg(this.channel, "*Time's up!*");
      this.currentTurn = 'End';
      this.showResults(true);
    }).bind(this), VOTING_PHASE * 60 * 1000);
    REMINDERS.forEach(t => setTimeout((function() {
        this.remindVoters(t);
      }).bind(this), t));
    return Promise.resolve();
  }

  remindVoters(elapsedTime) {
    this.client.sendMsg(this.channel, "Remaining time to vote: `" + (VOTING_PHASE - (elapsedTime / 60000)) + " minutes`");
    this.showResults(false);
  }

  showResults(showWinner) {
    let nonVoters = this.players.filter(player => Object.keys(this.votes).indexOf(player) < 0);
    let votedPlayers = Object.keys(this.tally);

    // Do not show anything if no votes have been received
    if (!votedPlayers.length) {
      this.client.sendMsg(this.channel, "No votes received yet...");
      if (showWinner) this.client.sendMsg(this.channel, "*You are all losers!*");
      return;
    }

    let toBeLynched = votedPlayers.reduce((function(previousPlayer, currentPlayer) {
          return this.clincher(previousPlayer, currentPlayer);
        }).bind(this));

    // Show tally
    this.client.sendMsg(this.channel, "Player with the most number of votes: <@" + toBeLynched + "> (" + this.tally[toBeLynched].length + ")");
    let tallyText = [];
    for (var player of votedPlayers) {
      if (player == toBeLynched) continue;
      tallyText.push("<@" + player + "> has " + this.tally[player].length + " votes");
    }
    if (tallyText.length) {
      this.client.sendMsg(this.channel, "Other players: " + tallyText.join(', '));
    }

    if (!showWinner) {
      if (nonVoters.length) {
        this.client.sendMsg(this.channel, "_These players have not voted yet:_ <@" + nonVoters.join('>, <@') + ">");
      }
    }
    else {
      this.client.sendMsg(this.channel, "<@" + toBeLynched + "> is a... `" + this.roles[toBeLynched] + "`!");
      if (this.roles[toBeLynched] == 'Werewolf') {
        this.winner = "Village Team";
        this.winningPlayers = Object.keys(this.roles).filter(player => ['Werewolf', 'Minion'].indexOf(this.roles[player]) < 0);
      }
      else {
        this.winner = "Werewolf Team";
        this.winningPlayers = Object.keys(this.roles).filter(player => ['Werewolf', 'Minion'].indexOf(this.roles[player]) >= 0);
      }
      this.client.sendMsg(this.channel, "Winner: *" + this.winner + "* <@" + this.winningPlayers.join('>, <@') + ">");
      if (nonVoters.length) {
        this.client.sendMsg(this.channel, "_These players did not vote:_ <@" + nonVoters.join('>, <@') + ">");
      }
    }
  }

  clincher(previousPlayer, currentPlayer) {
    if (this.tally[previousPlayer].length > this.tally[currentPlayer].length) {
      return previousPlayer;
    }
    else if (this.tally[previousPlayer].length < this.tally[currentPlayer].length) {
      return currentPlayer;
    }
    else {
      return Math.random() < 0.5 ? previousPlayer : currentPlayer;
    }
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
            (function(player) {
              this.sendPMInGame(player, "Your turn...");
              this.executePlayerTurn(player, this.origRoles[player]);
            }).bind(this));
        }
        else {
          setTimeout((function() {
            this.nextStep();
          }).bind(this), randomDelay());
        }
      }).bind(this));
  }

  filterPlayersByOriginalRole(role) {
    return Object.keys(this.origRoles).filter(
        player => role === this.origRoles[player]
      );
  }

  filterPlayersByRole(role) {
    return Object.keys(this.roles).filter(
        player => role === this.roles[player]
      );
  }

  sendPMInGame(recipient, message) {
    if (this.channel.startsWith('C')) {
      this.client.sendPM(recipient, "[`" + this.gameID + "`|<#" + this.channel +">] " + message);
    }
    else {
      this.client.sendPM(recipient, "[`" + this.gameID + "`] " + message);
    }
  }

  executePlayerTurn(player, role) {
    if (role == 'Werewolf') {
      let werewolves = this.filterPlayersByRole('Werewolf');
      if (werewolves.length > 1) {
        // give a list of werewolves
        this.sendPMInGame(player, "Werewolves: <@" + werewolves.join('> & <@') + ">");
      }
      else {
        // peek at center
        let center_idx = Math.floor(Math.random() * 3) + this.players.length;
        this.sendPMInGame(player, "You are the only werewolf, center peek: `" + this.roleDeck[center_idx] + "`");
      }
      this.nextStep();
    }

    else if (role == 'Minion') {
      let werewolves = this.filterPlayersByRole('Werewolf');
      if (werewolves.length) {
        this.sendPMInGame(player, "Werewolves: " + werewolves.join(' & '));
      }
      else {
        this.sendPMInGame(player, "Werewolves: _None_, survive on your own!");
      }
      this.nextStep();
    }

    else if (role == 'Seer') {
      this.sendPMInGame(player, "`!w peek-" + this.gameID + " center` to peek at 2 center cards or `!w peek-" + this.gameID + " @username` to peek at a player's card");
      let you = this.players.indexOf(player);
      let players = this.players.slice();
      players.splice(you, 1);
      if (players.length) {
        this.sendPMInGame(player, "The players are: <@" + players.join('>, <@') + ">");
      }

      this.timeLimit = setTimeout((function() {
        let target = 'center';
        // Roll two-face dice
        if (Math.random() < 0.5 ? false : true) {
          target = '<@' + players[Math.floor(Math.random() * players.length)] + '>';
        }
        this.sendPMInGame(player, "*Time limit reached!* Randomly choosing an action...");
        this.seerPeek(player, target);
      }).bind(this), TIME_LIMIT);
    }

    else if (role == 'Robber') {
      this.sendPMInGame(player, "`!w rob-" + this.gameID + " @username` to rob a player");
      let you = this.players.indexOf(player);
      let players = this.players.slice();
      players.splice(you, 1);
      if (players.length) {
        this.sendPMInGame(player, "The players are: <@" + players.join('>, <@') + ">");
      }

      this.timeLimit = setTimeout((function() {
        let target = '<@' + players[Math.floor(Math.random() * players.length)] + '>';
        this.sendPMInGame(player, "*Time limit reached!* Randomly choosing an action...");
        this.robberRob(player, target);
      }).bind(this), TIME_LIMIT);
    }

    else if (role == 'Troublemaker') {
      this.sendPMInGame(player, "`!w swap-" + this.gameID + " @userA @userB` to swap the players' cards");
      let you = this.players.indexOf(player);
      let players = this.players.slice();
      players.splice(you, 1);
      if (players.length) {
        this.sendPMInGame(player, "The players are: <@" + players.join('>, <@') + ">");
      }

      this.timeLimit = setTimeout((function() {
        let target1, target2;
        do {
          target1 = '<@' + players[Math.floor(Math.random() * players.length)] + '>';
          target2 = '<@' + players[Math.floor(Math.random() * players.length)] + '>';
        } while (target1 == target2);
        this.sendPMInGame(player, "*Time limit reached!* Randomly choosing an action...");
        this.troublemakerSwap(player, target1, target2);
      }).bind(this), TIME_LIMIT);
    }

    else if (role == 'Drunk') {
      let center_idx = Math.floor(Math.random() * 3) + this.players.length;
      let newRole = this.roleDeck[center_idx];
      let oldRole = this.roles[player];
      this.roleDeck[center_idx] = oldRole;
      this.roles[player] = newRole;
      this.sendPMInGame(player, "Your card has been swapped to the center");
      this.nextStep();
    }

    else if (role == 'Insomniac') {
      this.sendPMInGame(player, "Your card is...`" + this.roles[player] + "`");
      this.nextStep();
    }
  }

  seerPeek(sender, target) {
    // role check
    let seer = this.filterPlayersByOriginalRole('Seer');
    if (!seer.length) {
      this.sendPMInGame(sender, "Hey, you're not a Seer!");
      this.client.sendMsg(this.channel, "<@" + sender + "> is trying to be a Seer!");
      return;
    }

    // check current turn
    if (!this.currentTurn.startsWith('Seer')) {
      this.sendPMInGame(sender, "This is not the right time");
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
      this.sendPMInGame(sender, "Center peek: `" + this.roleDeck[center_idx1] + "`, `" + this.roleDeck[center_idx2] + "`");
    }

    // peek player card
    else {
      target = target.substring(2, target.length - 1);
      if (this.players.indexOf(target) < 0) {
        this.sendPMInGame(sender, "There are no players with that username: <@" + target + ">");
        return;
      }
      this.sendPMInGame(sender, "<@" + target + ">'s role is `" + this.roles[target] + "`");
    }
    this.nextStep();
  }

  robberRob(sender, target) {
    // role check
    let robber = this.filterPlayersByOriginalRole('Robber');
    if (!robber.length) {
      this.sendPMInGame(sender, "Hey, you're not a Robber!");
      this.client.sendMsg(this.channel, "<@" + sender + "> is trying to be a Robber!");
      return;
    }

    // check current turn
    if (!this.currentTurn.startsWith('Robber')) {
      this.sendPMInGame(sender, "This is not the right time");
      return;
    }

    target = target.substring(2, target.length - 1);
    if (this.players.indexOf(target) < 0) {
      this.sendPMInGame(sender, "There are no players with that username: <@" + target + ">");
      return;
    }
    let oldRole = this.roles[sender];
    let newRole = this.roles[target];
    this.roles[sender] = newRole;
    this.roles[target] = oldRole;
    this.sendPMInGame(sender, "Your new role is `" + this.roles[sender] + "`");
    this.nextStep();
  }

  troublemakerSwap(sender, target1, target2) {
    // role check
    let troublemaker = this.filterPlayersByOriginalRole('Troublemaker');
    if (!troublemaker.length) {
      this.sendPMInGame(sender, "Hey, you're not a Troublemaker!");
      this.client.sendMsg(this.channel, "<@" + sender + "> is trying to be a Troublemaker!");
      return;
    }

    // check current turn
    if (!this.currentTurn.startsWith('Troublemaker')) {
      this.sendPMInGame(sender, "This is not the right time");
      return;
    }

    if (target1 == target2) {
      this.sendPMInGame(sender, "You can't swap this player's card with his own");
      return;
    }

    target1 = target1.substring(2, target1.length - 1);
    if (this.players.indexOf(target1) < 0) {
      this.sendPMInGame(sender, "There are no players with that username: <@" + target1 + ">");
      return;
    }
    target2 = target2.substring(2, target2.length - 1);
    if (this.players.indexOf(target2) < 0) {
      this.sendPMInGame(sender, "There are no players with that username: <@" + target2 + ">");
      return;
    }
    let role1 = this.roles[target1];
    let role2 = this.roles[target2];
    this.roles[target1] = role2;
    this.roles[target2] = role1;
    this.sendPMInGame(sender, "You swapped their cards");
    this.nextStep();
  }

  lynchingVote(sender, target) {
    // check current turn
    if (!this.currentTurn.startsWith('Voting')) {
      this.client.sendMsg(this.channel, "This is not the right time");
      return;
    }

    target = target.substring(2, target.length - 1);
    if (this.players.indexOf(target) < 0) {
      this.client.sendMsg(this.channel, "There are no players with that username: <@" + target + ">");
      return;
    }

    if (this.votes.hasOwnProperty(sender)) {
      let vote = this.votes[sender];
      if (vote != target) {
        let voter_idx = this.tally[vote].indexOf(sender);
        this.tally[vote].splice(voter_idx, 1);
      }
    }

    this.votes[sender] = target;

    if (!this.tally.hasOwnProperty(target)) {
      this.tally[target] = [];
    }
    this.tally[target].push(sender);
    this.client.sendMsg(this.channel, "<@" + sender + "> voted for <@" + target + ">"
      + ", the player has " + this.tally[target].length + " vote(s) now");
  }

  forceEnd() {
    this.client.sendMsg(this.channel, "_Game was forced to end_");
    this.currentTurn = 'End';
  }

  asyncDelay(fn) {
    let args = Array.prototype.slice.call(arguments, this.asyncDelay.length);
    return new Promise((function(resolve, reject) {
        setTimeout((function() {
          fn.apply(this, args);
          resolve();
        }).bind(this), randomDelay());
      }).bind(this));
  }

}

function shuffle(o) {
  for(var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
  return o;
}

module.exports = Game;
