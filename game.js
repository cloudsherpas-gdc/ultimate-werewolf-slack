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
    this.client.sendMsg(this.channel, "Everyone, close your eyes.");
    // TODO: make this a single function
    this.wakeUpWerewolves();
    this.wakeUpMinion();
    this.wakeUpSeer();
    this.wakeUpRobber();
    this.wakeUpTroublemaker();
    this.wakeUpDrunk();
    this.wakeUpInsomniac();
    this.client.sendMsg(this.channel, "Wake up!");
  }

  wakeUpWerewolves() {
    // TODO: add some delays on each message
    this.client.sendMsg(this.channel, "`Werewolves`, wake up and look for other werewolves.");

    this.filterPlayersByRole('Werewolf').forEach(
        k => this.client.sendPM(
                this.assignments[k].id,
                "[`" + this.gameID + "`] Your turn..."
              )
      );

    this.client.sendMsg(this.channel, "`Werewolves`, close your eyes.");
  }

  wakeUpMinion() {
    this.client.sendMsg(this.channel, "`Minion`, wake up. Werewolves, <no need to actually do this> stick out your thumb so the minion can see who you are.");

    this.filterPlayersByRole('Minion').forEach(
        k => this.client.sendPM(
                this.assignments[k].id,
                "[`" + this.gameID + "`] Your turn..."
              )
      );

    this.client.sendMsg(this.channel, "Werewolves, put your thumbs away <duh>. `Minion`, close your eyes.");
  }

  wakeUpSeer() {
    this.client.sendMsg(this.channel, "`Seer`, wake up. You may look at another player's card or two of the center cards.");

    this.filterPlayersByRole('Seer').forEach(
        k => this.client.sendPM(
                this.assignments[k].id,
                "[`" + this.gameID + "`] Your turn..."
              )
      );

    this.client.sendMsg(this.channel, "`Seer`, close your eyes.");
  }

  wakeUpRobber() {
    this.client.sendMsg(this.channel, "`Robber`, wake up. You may exchange your card with another player's card, and then view your new card.");

    this.filterPlayersByRole('Robber').forEach(
        k => this.client.sendPM(
                this.assignments[k].id,
                "[`" + this.gameID + "`] Your turn..."
              )
      );

    this.client.sendMsg(this.channel, "`Robber`, close your eyes.");
  }

  wakeUpTroublemaker() {
    this.client.sendMsg(this.channel, "`Troublemaker`, wake up. You may exchange cards between two other players.");

    this.filterPlayersByRole('Troublemaker').forEach(
        k => this.client.sendPM(
                this.assignments[k].id,
                "[`" + this.gameID + "`] Your turn..."
              )
      );

    this.client.sendMsg(this.channel, "`Troublemaker`, close your eyes.");
  }

  wakeUpDrunk() {
    this.client.sendMsg(this.channel, "`Drunk`, wake up and exchange your card with a card from the center.");

    this.filterPlayersByRole('Drunk').forEach(
        k => this.client.sendPM(
                this.assignments[k].id,
                "[`" + this.gameID + "`] Your turn..."
              )
      );

    this.client.sendMsg(this.channel, "`Drunk`, close your eyes.");
  }

  wakeUpInsomniac() {
    this.client.sendMsg(this.channel, "`Insomniac`, wake up and look at your card");

    this.filterPlayersByRole('Insomniac').forEach(
        k => this.client.sendPM(
                this.assignments[k].id,
                "[`" + this.gameID + "`] Your turn..."
              )
      );

    this.client.sendMsg(this.channel, "`Insomniac`, close your eyes.");
  }

  filterPlayersByRole(role) {
    return Object.keys(this.assignments).filter(
        k => role === this.assignments[k].role
      );
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
