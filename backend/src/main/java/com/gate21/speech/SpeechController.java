package com.gate21.speech;

import com.gate21.common.CurrentUser;
import com.gate21.speech.SpeechService.AssessResponse;
import java.io.IOException;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/speech")
public class SpeechController {

    private final SpeechService speech;

    public SpeechController(SpeechService speech) {
        this.speech = speech;
    }

    @PostMapping(path = "/assess", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    AssessResponse assess(@AuthenticationPrincipal Jwt jwt,
                          @RequestPart("audio") MultipartFile audio,
                          @RequestParam("referenceText") String referenceText) throws IOException {
        return speech.assess(CurrentUser.id(jwt), audio.getBytes(), referenceText);
    }
}
