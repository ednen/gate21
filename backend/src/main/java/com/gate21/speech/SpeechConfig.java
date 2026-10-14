package com.gate21.speech;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.gate21.config.AppProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class SpeechConfig {

    @Bean
    SpeechAssessor speechAssessor(AppProperties props, ObjectMapper mapper) {
        return switch (props.speech().provider()) {
            case "azure" -> new AzureSpeechAssessor(props.speech().azure(), mapper);
            case "fake" -> new FakeSpeechAssessor();
            default -> throw new IllegalStateException("Unknown SPEECH_PROVIDER " + props.speech().provider());
        };
    }
}
