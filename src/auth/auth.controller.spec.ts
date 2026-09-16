import type { Response } from 'express';
import { AuthController } from './auth.controller';

describe('AuthController pages', () => {
  const controller = new AuthController({} as never, {} as never);

  it('serves the existing login page', () => {
    const { response, type, send } = responseDouble();

    controller.loginPage(response);

    expect(type).toHaveBeenCalledWith('html');
    expect(send).toHaveBeenCalledWith(
      expect.stringContaining('Sign in to open your dashboard.'),
    );
  });

  it('serves the setup request page before login', () => {
    const { response, type, send } = responseDouble();

    controller.signupPage(response);

    expect(type).toHaveBeenCalledWith('html');
    expect(send).toHaveBeenCalledWith(
      expect.stringContaining('Request KasiCash setup.'),
    );
  });
});

function responseDouble(): {
  response: Response;
  type: jest.Mock;
  send: jest.Mock;
} {
  const type = jest.fn();
  const send = jest.fn();
  const response = {
    type,
    send,
  };
  type.mockReturnValue(response);
  return { response: response as unknown as Response, type, send };
}
