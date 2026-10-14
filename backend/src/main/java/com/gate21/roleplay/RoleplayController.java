package com.gate21.roleplay;

import com.gate21.common.CurrentUser;
import com.gate21.roleplay.RoleplayService.SceneView;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.io.IOException;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/roleplay/sessions")
public class RoleplayController {

    public record StartRequest(@NotBlank @Size(max = 40) String scenario) {
    }

    private final RoleplayService roleplay;

    public RoleplayController(RoleplayService roleplay) {
        this.roleplay = roleplay;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    SceneView start(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody StartRequest req) {
        return roleplay.start(CurrentUser.id(jwt), req.scenario());
    }

    /** Send what the learner said: a WAV recording (transcribed server-side) and/or text. */
    @PostMapping(path = "/{sessionId}/turns", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    SceneView turn(@AuthenticationPrincipal Jwt jwt,
                   @PathVariable UUID sessionId,
                   @RequestPart(value = "audio", required = false) MultipartFile audio,
                   @RequestParam(value = "text", required = false) @Size(max = 300) String text) throws IOException {
        byte[] bytes = audio == null || audio.isEmpty() ? null : audio.getBytes();
        return roleplay.turn(CurrentUser.id(jwt), sessionId, text, bytes);
    }
}
