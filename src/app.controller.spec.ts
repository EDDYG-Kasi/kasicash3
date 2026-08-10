import { AppController } from './app.controller';

describe('AppController', () => {
  const controller = new AppController();

  it('returns a simple API root response', () => {
    expect(controller.root()).toEqual({
      ok: true,
      service: 'kasicash-api',
    });
  });
});
