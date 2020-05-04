//@ts-ignore
import tapSpec from 'tap-spec';
import { Reporter } from '../core/Reporter';

export const specReporter: Reporter = (stream) => {
  stream.pipe(tapSpec()).pipe(process.stdout);
};
