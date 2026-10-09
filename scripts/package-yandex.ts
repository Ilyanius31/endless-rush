import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { dirname } from 'node:path';
import { validateBuild } from './validate-build.ts';
import { validateArchive, YANDEX_ARCHIVE } from './validate-zip.ts';

validateBuild('yandex');
mkdirSync(dirname(YANDEX_ARCHIVE), { recursive: true });
// Удаляется только предыдущий сгенерированный архив, чтобы zip не оставил
// внутри него файлы, которых уже нет в новой сборке.
if (existsSync(YANDEX_ARCHIVE)) unlinkSync(YANDEX_ARCHIVE);
execFileSync('zip', ['-X', '-q', '-r', YANDEX_ARCHIVE, '.'], { cwd: 'dist/yandex' });
validateArchive();
