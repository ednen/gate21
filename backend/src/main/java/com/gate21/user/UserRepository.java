package com.gate21.user;

import com.gate21.common.Db;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class UserRepository {

    public record UserRow(UUID id, String email, String passwordHash, String displayName, String timezone,
                          int reminderHour, Instant voiceConsentAt, Instant createdAt) {
    }

    private final JdbcClient jdbc;

    public UserRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** Inserts the user and their empty stats row. Returns false when the email is taken. */
    public boolean insert(UserRow user) {
        int inserted = jdbc.sql("""
                INSERT INTO users (id, email, password_hash, display_name, timezone, reminder_hour, created_at)
                VALUES (:id, :email, :hash, :name, :tz, :hour, :createdAt)
                ON CONFLICT (email) DO NOTHING
                """)
            .param("id", user.id())
            .param("email", user.email())
            .param("hash", user.passwordHash())
            .param("name", user.displayName())
            .param("tz", user.timezone())
            .param("hour", user.reminderHour())
            .param("createdAt", Db.ts(user.createdAt()))
            .update();
        if (inserted == 0) {
            return false;
        }
        jdbc.sql("INSERT INTO user_stats (user_id) VALUES (:id)").param("id", user.id()).update();
        return true;
    }

    public Optional<UserRow> findByEmail(String email) {
        return jdbc.sql("SELECT * FROM users WHERE email = :email")
            .param("email", email)
            .query(UserRepository::map)
            .optional();
    }

    public Optional<UserRow> findById(UUID id) {
        return jdbc.sql("SELECT * FROM users WHERE id = :id")
            .param("id", id)
            .query(UserRepository::map)
            .optional();
    }

    public void updateProfile(UUID id, String displayName, String timezone, int reminderHour) {
        jdbc.sql("UPDATE users SET display_name = :name, timezone = :tz, reminder_hour = :hour WHERE id = :id")
            .param("name", displayName)
            .param("tz", timezone)
            .param("hour", reminderHour)
            .param("id", id)
            .update();
    }

    public void setVoiceConsent(UUID id, Instant at) {
        jdbc.sql("UPDATE users SET voice_consent_at = :at WHERE id = :id")
            .param("at", Db.ts(at), Types.TIMESTAMP_WITH_TIMEZONE)
            .param("id", id)
            .update();
    }

    /** Deletes the account; every user-owned table cascades. */
    public void delete(UUID id) {
        jdbc.sql("DELETE FROM users WHERE id = :id").param("id", id).update();
    }

    private static UserRow map(ResultSet rs, int rowNum) throws SQLException {
        return new UserRow(
            rs.getObject("id", UUID.class),
            rs.getString("email"),
            rs.getString("password_hash"),
            rs.getString("display_name"),
            rs.getString("timezone"),
            rs.getInt("reminder_hour"),
            Db.instant(rs, "voice_consent_at"),
            Db.instant(rs, "created_at"));
    }
}
