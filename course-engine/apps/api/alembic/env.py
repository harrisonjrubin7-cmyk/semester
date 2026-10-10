from logging.config import fileConfig
from alembic import context
from sqlalchemy import engine_from_config, pool
from app.core.config import settings
from app.core.database import Base
from app.models import entities

config = context.config
config.set_main_option("sqlalchemy.url", settings.database_url)
if config.config_file_name: fileConfig(config.config_file_name)
target_metadata = Base.metadata

def run_migrations_offline():
    context.configure(url=settings.database_url, target_metadata=target_metadata, literal_binds=True, compare_type=True)
    with context.begin_transaction(): context.run_migrations()

def _run_migrations(connection):
    if connection.in_transaction():
        raise RuntimeError("Alembic requires a connection without an active caller transaction")
    is_sqlite = connection.dialect.name == "sqlite"
    sqlite_foreign_keys = False
    if is_sqlite:
        sqlite_foreign_keys = connection.exec_driver_sql("PRAGMA foreign_keys").scalar_one() == 1
        # SQLAlchemy autobegins on every PRAGMA read. End that transaction in
        # both FK modes so Alembic owns the migration transaction that follows.
        connection.commit()
    if sqlite_foreign_keys:
        connection.exec_driver_sql("PRAGMA foreign_keys=OFF")
        connection.commit()
    migration_succeeded = False
    try:
        context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
        with context.begin_transaction():
            context.run_migrations()
        migration_succeeded = True
    finally:
        if is_sqlite:
            if connection.in_transaction():
                if migration_succeeded:
                    connection.commit()
                else:
                    connection.rollback()
            if sqlite_foreign_keys:
                connection.exec_driver_sql("PRAGMA foreign_keys=ON")
            violations = connection.exec_driver_sql("PRAGMA foreign_key_check").all()
            connection.commit()
            if violations and migration_succeeded:
                raise RuntimeError(f"SQLite foreign-key violations after migration: {violations}")


def run_migrations_online():
    supplied_connection = config.attributes.get("connection")
    if supplied_connection is not None:
        _run_migrations(supplied_connection)
        return
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        _run_migrations(connection)

run_migrations_offline() if context.is_offline_mode() else run_migrations_online()
