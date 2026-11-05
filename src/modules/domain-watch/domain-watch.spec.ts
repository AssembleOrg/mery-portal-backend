import { DomainWatchService } from './domain-watch.service';

describe('DomainWatchService', () => {
  const build = () => {
    const service = new DomainWatchService({
      get: (key: string, fallback?: string) =>
        key === 'MENTORSHIP_ALERT_EMAILS' ? 'alerta@example.com' : (fallback ?? ''),
    } as any);
    const send = jest.fn().mockResolvedValue({});
    (service as any).api.sendTransacEmail = send;
    const check = jest.spyOn(service, 'check');
    return { service, send, check };
  };

  it('avisa una sola vez recién al tercer control fallido', async () => {
    const { service, send, check } = build();
    check.mockResolvedValue({ ok: false, reason: 'DNS: SERVFAIL' });
    await service.tick();
    await service.tick();
    expect(send).not.toHaveBeenCalled();
    await service.tick();
    await service.tick();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].subject).toContain('no responde');
  });

  it('una falla aislada no avisa y el contador se reinicia', async () => {
    const { service, send, check } = build();
    check.mockResolvedValueOnce({ ok: false, reason: 'x' });
    check.mockResolvedValueOnce({ ok: false, reason: 'x' });
    check.mockResolvedValueOnce({ ok: true, ip: '1.1.1.1' });
    check.mockResolvedValueOnce({ ok: false, reason: 'x' });
    for (let i = 0; i < 4; i++) await service.tick();
    expect(send).not.toHaveBeenCalled();
  });

  it('avisa cuando vuelve a responder después de una alerta', async () => {
    const { service, send, check } = build();
    check.mockResolvedValue({ ok: false, reason: 'x' });
    for (let i = 0; i < 3; i++) await service.tick();
    check.mockResolvedValue({ ok: true, ip: '153.52.255.60' });
    await service.tick();
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][0].subject).toContain('volvió');
  });
});
