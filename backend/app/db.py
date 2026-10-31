import time
import uuid
from sqlalchemy import Column, String, Text, Integer, Float, ForeignKey, JSON, UniqueConstraint, create_engine, event, text
from sqlalchemy.orm import declarative_base, sessionmaker
from pgvector.sqlalchemy import Vector
from .config import DATABASE_URL

engine = create_engine(DATABASE_URL, connect_args={'check_same_thread': False, 'timeout': 30} if DATABASE_URL.startswith('sqlite') else {}, pool_pre_ping=True)
if DATABASE_URL.startswith('sqlite'):
    @event.listens_for(engine, 'connect')
    def configure_sqlite(connection, _):
        connection.execute('PRAGMA foreign_keys=ON')
        connection.execute('PRAGMA journal_mode=WAL')
Session = sessionmaker(engine, expire_on_commit=False)
Base = declarative_base()
def uid(): return str(uuid.uuid4())

class User(Base):
    __tablename__ = 'users'
    id = Column(String, primary_key=True, default=uid)
    email = Column(String, unique=True, nullable=False)
    password = Column(String, nullable=False)

class Login(Base):
    __tablename__ = 'logins'
    token = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    expires = Column(Float, nullable=False)

class Workspace(Base):
    __tablename__ = 'workspaces'
    id = Column(String, primary_key=True, default=uid)
    owner_id = Column(String, ForeignKey('users.id'), nullable=False, index=True)
    name = Column(String, nullable=False)
    created = Column(Float, default=time.time)

class Document(Base):
    __tablename__ = 'documents'
    __table_args__ = (UniqueConstraint('workspace_id', 'digest'),)
    id = Column(String, primary_key=True, default=uid)
    workspace_id = Column(String, ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=False, index=True)
    name = Column(String, nullable=False)
    digest = Column(String, nullable=False, index=True)
    size = Column(Integer, nullable=False)
    status = Column(String, default='queued', index=True)
    error = Column(Text)
    pages = Column(Integer, default=0)
    chunk_count = Column(Integer, default=0)
    created = Column(Float, default=time.time)
    lease = Column(Float, default=0)
    generation = Column(Integer, default=0)

class Chunk(Base):
    __tablename__ = 'chunks'
    id = Column(String, primary_key=True, default=uid)
    document_id = Column(String, ForeignKey('documents.id', ondelete='CASCADE'), nullable=False, index=True)
    workspace_id = Column(String, ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=False, index=True)
    page = Column(Integer, nullable=False)
    ordinal = Column(Integer, nullable=False)
    text = Column(Text, nullable=False)
    embedding = Column(Vector(1536).with_variant(JSON(), 'sqlite'))
    embedding_model = Column(String)

class ExternalConnection(Base):
    __tablename__ = 'external_connections'
    workspace_id = Column(String, ForeignKey('workspaces.id', ondelete='CASCADE'), primary_key=True)
    provider = Column(String, primary_key=True)
    account = Column(String, nullable=False)
    secret = Column(Text, nullable=False)

class GmailConnection(Base):
    __tablename__ = 'gmail_connections'
    workspace_id = Column(String, ForeignKey('workspaces.id', ondelete='CASCADE'), primary_key=True)
    email = Column(String, nullable=False)
    refresh_token = Column(Text, nullable=False)

class DriveOAuthState(Base):
    __tablename__ = 'drive_oauth_states'
    value = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    workspace_id = Column(String, ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=False)
    expires = Column(Float, nullable=False)

class GmailOAuthState(Base):
    __tablename__ = 'gmail_oauth_states'
    value = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    workspace_id = Column(String, ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=False)
    expires = Column(Float, nullable=False)

class Conversation(Base):
    __tablename__ = 'conversations'
    id = Column(String, primary_key=True, default=uid)
    workspace_id = Column(String, ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=False, index=True)
    title = Column(String(120), nullable=False)
    messages = Column(JSON, nullable=False, default=list)
    created = Column(Float, default=time.time)
    updated = Column(Float, default=time.time, index=True)

def init_db():
    if engine.dialect.name == 'postgresql':
        with engine.begin() as conn: conn.execute(text('CREATE EXTENSION IF NOT EXISTS vector'))
    Base.metadata.create_all(engine)
    if engine.dialect.name == 'postgresql':
        with engine.begin() as conn:
            conn.execute(text("CREATE INDEX IF NOT EXISTS chunks_text_idx ON chunks USING gin(to_tsvector('english', text))"))
            conn.execute(text('CREATE INDEX IF NOT EXISTS chunks_vector_idx ON chunks USING hnsw (embedding vector_cosine_ops)'))
