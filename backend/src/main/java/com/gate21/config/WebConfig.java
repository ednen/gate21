package com.gate21.config;

import java.time.Clock;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.filter.ShallowEtagHeaderFilter;

@Configuration
public class WebConfig {

    @Bean
    Clock clock() {
        return Clock.systemUTC();
    }

    /** Lets clients revalidate content packs with If-None-Match and get 304s instead of the full JSON. */
    @Bean
    FilterRegistrationBean<ShallowEtagHeaderFilter> contentEtagFilter() {
        FilterRegistrationBean<ShallowEtagHeaderFilter> bean = new FilterRegistrationBean<>(new ShallowEtagHeaderFilter());
        bean.addUrlPatterns("/api/v1/content/*");
        return bean;
    }
}
