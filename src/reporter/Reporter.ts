import { Readable } from 'stream';

export type Reporter = (stream: Readable) => Promise<void> | void;
