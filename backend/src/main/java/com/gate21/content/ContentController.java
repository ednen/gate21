package com.gate21.content;

import com.gate21.common.ApiException;
import java.time.Duration;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Public, cacheable content packs. The app bundles a copy and checks the manifest version for updates. */
@RestController
@RequestMapping("/api/v1/content")
public class ContentController {

    private static final CacheControl CACHE = CacheControl.maxAge(Duration.ofMinutes(5)).cachePublic();

    private final ContentService content;

    public ContentController(ContentService content) {
        this.content = content;
    }

    @GetMapping("/manifest")
    ResponseEntity<byte[]> manifest() {
        return json(content.manifestJson());
    }

    @GetMapping("/chapters/{slug}")
    ResponseEntity<byte[]> chapter(@PathVariable String slug) {
        return json(content.chapterJson(slug)
            .orElseThrow(() -> ApiException.notFound("CHAPTER_NOT_FOUND", "No chapter " + slug)));
    }

    @GetMapping("/placement")
    ResponseEntity<byte[]> placement() {
        return json(content.placementJson());
    }

    @GetMapping("/sos")
    ResponseEntity<byte[]> sos() {
        return json(content.sosJson());
    }

    private ResponseEntity<byte[]> json(byte[] body) {
        return ResponseEntity.ok()
            .contentType(MediaType.APPLICATION_JSON)
            .cacheControl(CACHE)
            .header("X-Content-Version", content.version())
            .body(body);
    }
}
