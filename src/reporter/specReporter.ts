//@ts-ignore
import tapSpec from 'tap-spec';
import { Reporter } from './Reporter';

export const specReporter: Reporter = (stream) => {
  stream.pipe(tapSpec()).pipe(process.stdout);
};
