# ultimate-werewolf-slack

A bot that moderates Ultimate Werewolf games (3-8 players)

Inspired by [chrisgillis/slackwolf](https://github.com/chrisgillis/slackwolf) but this one plays the [One Night Ultimate Werewolf](https://boardgamegeek.com/boardgame/147949/one-night-ultimate-werewolf) variation. Supported roles are: `Werewolf`, `Minion`, `Seer`, `Robber`, `Troublemaker`, `Drunk`, `Insomniac`, `Villager`. You can download the rulebook [here](https://drive.google.com/file/d/0BzzjKoXCqlyubTUxZFRPblFoMFU/view?usp=sharing).

Run it with `SLACK_API_TOKEN=<token_here> node index.js`

## Instructions

* Anyone can chat `!w start` in a channel to start a new game. There can only be one game in-progress per channel.
* You can also specify players by chatting `!w start @user1 @user2 ...`, up to 8 players in total
* A Seer can PM the @werewolf-mod `!w peek-gameid center` to peek at 2 random center cards or `!w peek @user` to peek at a player's card
* A Robber can PM the @werewolf-mod `!w rob-gameid @user` to rob a user
* A Troublemaker can PM the @werewolf-mod `!w swap-gameid @user1 @user2` to swap @user1 and @user2's cards
* Anyone can chat `!w vote @user` to vote who will be lynched
* Anyone can chat `!w force-end` to end a game prematurely
* Typing `!w help` will show this help message
