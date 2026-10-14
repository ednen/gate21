package com.gate21.content;

import java.util.List;

/** Typed views of the JSON content packs in /content. Field names match the JSON keys. */
public final class ContentModels {

    private ContentModels() {
    }

    public record Manifest(String version, List<WeekInfo> weeks, List<ChapterInfo> chapters) {
        public Manifest {
            weeks = List.copyOf(weeks);
            chapters = List.copyOf(chapters);
        }
    }

    public record WeekInfo(int week, String level, String levelTr, int startDay) {
    }

    public record ChapterInfo(String slug, int week, int order, String title, String titleTr, String icon, boolean available) {
    }

    /** The fields of a chapter file the server needs; the app receives the whole file. */
    public record ChapterMeta(String slug, String mission, String missionTr, String stamp, String scenario) {
    }

    public record Scenario(String slug, String chapter, String title, String titleTr, String role, String setting,
                           String persona, String opening, List<Goal> goals) {
        public Scenario {
            goals = List.copyOf(goals);
        }
    }

    public record Goal(String id, boolean twist, String instruction, String hint, List<String> keywords,
                       String successReply, String retryReply, List<Option> options) {
        public Goal {
            keywords = keywords == null ? List.of() : List.copyOf(keywords);
            options = options == null ? List.of() : List.copyOf(options);
        }
    }

    public record Option(String text, List<String> keywords, String reply) {
        public Option {
            keywords = keywords == null ? List.of() : List.copyOf(keywords);
        }
    }

    public record Placement(List<Question> questions, List<SpeakingTask> speaking, List<Band> bands) {
        public Placement {
            questions = List.copyOf(questions);
            speaking = List.copyOf(speaking);
            bands = List.copyOf(bands);
        }
    }

    public record Question(String tag, String prompt, List<String> options, int answer, String explainTr) {
    }

    public record SpeakingTask(String situationTr, String phrase) {
    }

    public record Band(int min, String level, int startDay, String messageTr) {
    }
}
