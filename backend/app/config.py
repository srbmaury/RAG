import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / '.env')
DATA = Path(os.getenv('DATA_DIR', './data')).resolve()
DATA.mkdir(parents=True, exist_ok=True)
DATABASE_URL = os.getenv('DATABASE_URL', f'sqlite:///{DATA}/atlas.db')
API_KEY = os.getenv('OPENAI_API_KEY', '')
CHAT_MODEL = os.getenv('CHAT_MODEL', 'gpt-4.1-mini')
EMBED_MODEL = os.getenv('EMBED_MODEL', 'text-embedding-3-small')
MAX_FILE_BYTES = int(os.getenv('MAX_FILE_MB', '250')) * 1024 * 1024
COOKIE_SECURE = os.getenv('COOKIE_SECURE', 'false').lower() == 'true'
AI_PROVIDER = os.getenv('AI_PROVIDER', 'openai' if API_KEY else 'none')
OLLAMA_URL = os.getenv('OLLAMA_URL', 'http://127.0.0.1:11434').rstrip('/')
OLLAMA_CHAT_MODEL = os.getenv('OLLAMA_CHAT_MODEL', 'qwen3:4b')
OLLAMA_EMBED_MODEL = os.getenv('OLLAMA_EMBED_MODEL', 'nomic-embed-text')
