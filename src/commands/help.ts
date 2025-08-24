import { Composer } from "grammy";

import { CommandsHelper } from "../util/commands-helper";

const composer = new Composer();

composer.command("help", (ctx) =>
  ctx.reply(
    `<blockquote>🎯 WordHush 🎯</blockquote>

🤖 <i>AI-Powered Word Guessing Challenge</i>

Welcome to WordHush - the ultimate word guessing game where our AI gives you clever hints and you race to discover the hidden word!

🎮 <b>How to Play:</b>
• The AI will provide you with creative hints
• Use your detective skills to guess the correct word
• Challenge yourself across different difficulty levels

🚀 <b>Start Playing:</b>
<code>/newhush</code> - Interactive mode selection
<code>/newhush easy</code> - Beginner friendly (3-4 letter words)
<code>/newhush medium</code> - Standard challenge (5-6 letter words)  
<code>/newhush hard</code> - Advanced level (7-8 letter words)
<code>/newhush extreme</code> - Expert mode (9+ letter words)
<code>/newhush random</code> - Surprise difficulty!

⚡ <b>Game Controls:</b>
<code>/endhush</code> - End current game
<code>/help</code> - Show commands and rules
<code>/sethushtopic</code> - Use this to set a topic in a group to play the game. It will ignore other topics.
<code>/unsethushtopic</code> - Use this command to unset the game topic.

Ready to test your word skills? Type <code>/newhush</code> to begin! 🧠✨`,
    { parse_mode: "HTML" },
  ),
);

CommandsHelper.addNewCommand(
  "help",
  "Get help on how to play and commands list.",
);

export const helpCommand = composer;
