# WordHush

## Features
- AI-powered word guessing game with intelligent, context-aware hints.
- Play in private chats or compete with others in group chats.
- Multiple difficulty levels: Easy, Medium, Hard, Extreme, and Random.
- Topic-based gameplay in groups in case of specific topic for games.
- Track your progress with group and global leaderboards.
- Comprehensive scoring system and personal statistics.
- Powered by Google Gemini AI for creative and challenging hints.

## How to Play
1. **Start a game**: Use the `/newhush` command to begin.
2. **Choose difficulty**: Select from Easy (3-4 letters) to Extreme (9+ letters), or go Random!
3. **Read the AI hints**: The AI provides clever clues about the hidden word.
4. **Guess the word**: Type your guess in the chat.
5. **Win the round**: Be the first to guess correctly and earn points!

### Difficulty Levels
- 🟢 **Easy** - Perfect for beginners
- 🟡 **Medium** - Standard challenge
- 🟠 **Hard** - Advanced players
- 🔴 **Extreme** - Expert mode
- 🎲 **Random** - Surprise difficulty every game!

## Commands
- **/newhush** - Start a new game with interactive difficulty selection.
- **/newhush [difficulty]** - Start a game with specific difficulty (easy/medium/hard/extreme/random).
- **/endhush** - End the current game (admins only in group chats).
- **/help** - Display help with commands and game rules.
- **/setgametopic** - Set a specific topic of group for game (admins only). Example:
  ```
  /sethushtopic
  ```
- **/unsetgametopic** - Remove the topic restriction (admins only).
- **/leaderboard** - View leaderboards for the group or globally. Example:
  ```
  /leaderboard global week
  /leaderboard group month
  ```
- **/myscore** - View your personal score and statistics. Example:
  ```
  /myscore group all
  /myscore global today
  ```
- **/stats** - View bot usage statistics (admin users only).

## Installation & Setup

### Requirements
- Bun.js Runtime (or Node.js)
- Telegram Bot Token (create one via [BotFather](https://core.telegram.org/bots#botfather))
- PostgreSQL database
- Redis server (for caching and session management)
- Google Gemini API Key (get from [Google AI Studio](https://makersuite.google.com/app/apikey))

### Steps
1. **Clone the repository**:
   ```bash
   git clone https://github.com/binamralamsal/WordHush
   cd WordHush
   ```

2. **Install dependencies**:
   ```bash
   bun install
   ```

3. **Configure environment variables**:
   Create a `.env` file in the root directory with the following variables:
   ```env
   # Telegram Bot Configuration
   BOT_TOKEN=your-telegram-bot-token
   CUSTOM_API_ROOT=https://api.telegram.org

   # Database Configuration
   DATABASE_URL=postgresql://user:password@localhost:5432/wordhush

   # Redis Configuration
   REDIS_URI=redis://127.0.0.1:6379

   # Application Configuration
   NODE_ENV=development

   # Google Gemini AI API Keys (space-separated if multiple)
   GEMINI_API_KEYS=your-gemini-api-key

   # Admin Users (space-separated user IDs)
   ADMIN_USERS=123456789
   ```

4. **Set up the database**:
   Run the database migrations to set up the required tables:
   ```bash
   bun db:migrate latest
   ```

5. **Start the bot**:
   - **Development mode** (with hot reload):
     ```bash
     bun run dev
     ```
   - **Production mode**:
     ```bash
     bun run start
     ```

### Additional Database Commands
- **Run migrations**:
  ```bash
  bun run db:migrate latest
  bun run db:migrate up
  bun run db:migrate down
  ```
- **Seed database**:
  ```bash
  bun run db:seed
  ```
- **Generate type definitions**: 
  ```bash
  bun run db:codegen # run this after migrations
  ```

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `BOT_TOKEN` | Your Telegram bot token from BotFather | `123456789:ABCdefGHIjklMNOpqrsTUVwxyz` |
| `CUSTOM_API_ROOT` | Custom Telegram API root URL (optional) | `https://api.telegram.org` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:password@localhost:5432/wordhush` |
| `REDIS_URI` | Redis connection string | `redis://127.0.0.1:6379` |
| `NODE_ENV` | Environment mode | `development` or `production` |
| `GEMINI_API_KEYS` | Google Gemini AI API keys (space-separated) | `AIzaSy...` |
| `ADMIN_USERS` | User IDs with admin permissions (space-separated) | `123456789 987654321` |

### Custom API Setup
If your bot is experiencing slow response times, you can set up a local Telegram Bot API server. Follow the [official guide](https://tdlib.github.io/telegram-bot-api/build.html?os=Linux) and update the `CUSTOM_API_ROOT` environment variable accordingly.

## Technologies Used
- **[grammy](https://grammy.dev/)**: Modern Telegram Bot API framework.
- **Google Gemini AI**: Advanced AI for generating creative word hints.
- **Kysely**: Type-safe SQL query builder and database toolkit.
- **PostgreSQL**: Persistent storage for game data and leaderboards.
- **Redis**: Caching, session management, and rate limiting.
- **Bun.js**: Fast JavaScript runtime and package manager.
- **Zod**: Runtime type checking and schema validation.

## Try the Bot
- **[WordHush Bot](https://t.me/WordHushBot)** - Start playing now!

## Community
- **Join the Official Group**: [WordHush Community](https://t.me/WordGuesser) - Play the game, discuss strategies, and share feedback.
- **Support the Developer**: [Binamra Bots Channel](https://t.me/BinamraBots)
- **Contact the Developer**: Have suggestions or issues? Reach out on Telegram: [@binamralamsal](https://t.me/binamralamsal)

## Contributing
We welcome contributions to enhance the bot! Here's how you can help:

1. **Fork the repository** on GitHub.
2. **Create a new branch** for your feature or bugfix:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes** and ensure they follow the project's coding standards.
4. **Test your changes** thoroughly in development mode.
5. **Commit your changes** with descriptive commit messages:
   ```bash
   git commit -m "Add: new feature description"
   ```
6. **Push to your fork** and **open a pull request** with a clear description of your changes.

### Development Guidelines
- Follow the existing code style and structure.
- Add appropriate error handling for new features.
- Update documentation for any new commands or features.
- Test both private chat and group chat functionality.

## Troubleshooting

### Common Issues
- **Database connection errors**: Ensure PostgreSQL is running and the `DATABASE_URL` is correct.
- **Redis connection errors**: Make sure Redis server is running on the specified port.
- **Bot not responding**: Verify your `BOT_TOKEN` is valid and the bot is not already running elsewhere.
- **AI hint errors**: Ensure your `GEMINI_API_KEYS` are valid and have sufficient quota.
- **Migration errors**: Ensure you have proper database permissions and the database exists.

### Getting Help
If you encounter issues:
1. Check the [Issues](https://github.com/binamralamsal/WordHush/issues) page on GitHub.
2. Join the [WordHush Community](https://t.me/WordGuesser) for support.
3. Contact the developer directly: [@binamralamsal](https://t.me/binamralamsal)

## License
This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more details.
