package com.gate21.content;

import java.util.List;

/** Typed views of the JSON content packs in /content. Field names match the JSON keys. */
public final class ContentModels {

    private ContentModels() {
    }

    public record Manifest(String version, int freeDays, List<LevelInfo> levels, Graduation graduation,
                           List<Stop> stops, List<ChapterInfo> chapters) {
        public Manifest {
            levels = List.copyOf(levels);
            stops = List.copyOf(stops);
            chapters = List.copyOf(chapters);
        }
    }

    /** Bronze, Silver and Gold Traveller: one per week of the journey, each a different trip. */
    public record LevelInfo(int week, String id, String title, String titleTr, String tagline, String message,
                            String messageTr, String trip, int startDay) {
    }

    public record Graduation(String title, String titleTr, List<String> lines, List<String> linesTr) {
        public Graduation {
            lines = List.copyOf(lines);
            linesTr = List.copyOf(linesTr);
        }
    }

    /** One stage of a trip (arrival, transfer, hotel…). Every week revisits all seven. */
    public record Stop(String slug, int order, String title, String titleTr, String icon) {
    }

    /**
     * One unit of progress. {@code kind}: {@code lesson} (a stop at one level, one journey day),
     * {@code starter} (the zero-English pack) or {@code simulation} (Full Trip).
     */
    public record ChapterInfo(String slug, String kind, String stop, int week, int day, int order, String title,
                              String titleTr, String icon, boolean available) {

        public boolean isLesson() {
            return "lesson".equals(kind);
        }

        public boolean isStarter() {
            return "starter".equals(kind);
        }

        public boolean isSimulation() {
            return "simulation".equals(kind);
        }
    }

    /**
     * The fields of a chapter file the server needs; the app receives the whole file.
     * {@code requiredBits} are the chapter's own steps; {@code scenario} is null without a Survive step.
     */
    public record ChapterMeta(String slug, String kind, int requiredBits, String mission, String missionTr,
                              String stamp, String scenario) {
    }

    /**
     * A role-play scene. Goals run in order; after a goal named in {@code twistSlots}, one or
     * more surprises from that slot's pool are drawn at random. {@code {fact}} placeholders in
     * any line are filled with values drawn per session, and {@code {name}} with the guest's name.
     */
    public record Scenario(String slug, String chapter, String title, String titleTr, String role, String setting,
                           String voice, String persona, String briefTr, String opening, List<Fact> facts,
                           List<Goal> goals, List<Twist> twists, List<TwistSlot> twistSlots, String closing) {
        public Scenario {
            facts = facts == null ? List.of() : List.copyOf(facts);
            goals = List.copyOf(goals);
            twists = twists == null ? List.of() : List.copyOf(twists);
            twistSlots = twistSlots == null ? List.of() : List.copyOf(twistSlots);
        }
    }

    /** Something the character tells the guest, asked back in the memory check after the scene. */
    public record Fact(String id, List<String> values, String question, String questionTr) {
        public Fact {
            values = List.copyOf(values);
        }
    }

    /**
     * One thing the guest has to do. {@code ask} is the character's line that opens the goal.
     * A goal with its own {@code role} starts a new segment with a new character (Full Trip).
     */
    public record Goal(String id, String titleTr, String ask, String instruction, String hint, String hintTr,
                       List<String> keywords, String successReply, String retryReply, String role, String setting,
                       String voice, String persona) {
        public Goal {
            keywords = keywords == null ? List.of() : List.copyOf(keywords);
        }
    }

    /** An unexpected problem. {@code intro} is how the character breaks the news. */
    public record Twist(String id, String titleTr, String intro, String instruction, String retryReply,
                        List<Option> options) {
        public Twist {
            options = options == null ? List.of() : List.copyOf(options);
        }
    }

    public record Option(String text, List<String> keywords, String reply) {
        public Option {
            keywords = keywords == null ? List.of() : List.copyOf(keywords);
        }
    }

    public record TwistSlot(String after, List<String> pool) {
        public TwistSlot {
            pool = List.copyOf(pool);
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

    public record Band(int min, String level, int startDay, boolean starter, String messageTr) {
    }
}
