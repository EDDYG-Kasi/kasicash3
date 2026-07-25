import { AppController } from './app.controller';

describe('AppController', () => {
  const controller = new AppController();

  it('returns a simple API root response', () => {
    expect(controller.root()).toEqual({
      ok: true,
      service: 'kasicash-api',
    });
  });

  it('returns a simple health response', () => {
    expect(controller.health()).toEqual({ ok: true });
  });
});
