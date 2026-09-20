import { Config } from '@remotion/cli/config';

/**
 * The lesson MP3s stay where the app serves them.
 *
 * `app/public` is already the directory the app publishes, and `lesson.file`
 * is already a path inside it. Pointing Remotion here means the video plays
 * the very file the student streams — not a copy that can go stale when a
 * unit is re-rendered.
 */
Config.setPublicDir('../app/public');
Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
