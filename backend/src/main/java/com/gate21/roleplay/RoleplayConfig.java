package com.gate21.roleplay;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.gate21.config.AppProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RoleplayConfig {

    @Bean
    RoleplayModel roleplayModel(AppProperties props, ObjectMapper mapper) {
        return switch (props.roleplay().provider()) {
            case "gemini" -> new GeminiRoleplayModel(props.roleplay().gemini(), mapper);
            case "fake" -> new ScriptedRoleplayModel();
            default -> throw new IllegalStateException("Unknown ROLEPLAY_PROVIDER " + props.roleplay().provider());
        };
    }
}
