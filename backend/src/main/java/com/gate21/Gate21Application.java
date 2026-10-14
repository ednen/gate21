package com.gate21;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class Gate21Application {

    public static void main(String[] args) {
        SpringApplication.run(Gate21Application.class, args);
    }
}
