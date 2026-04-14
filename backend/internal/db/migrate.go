package db

import (
	"errors"
	"strings"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/pgx/v5"
	_ "github.com/golang-migrate/migrate/v4/source/file"
)

func RunMigrations(databaseURL, migrationsPath string) error {
	// golang-migrate pgx/v5 driver expects "pgx5://" scheme
	dbURL := strings.Replace(databaseURL, "postgres://", "pgx5://", 1)
	dbURL = strings.Replace(dbURL, "postgresql://", "pgx5://", 1)

	m, err := migrate.New(migrationsPath, dbURL)
	if err != nil {
		return err
	}
	defer m.Close()
	if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return err
	}
	return nil
}
