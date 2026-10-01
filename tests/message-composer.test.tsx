// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import type { ActorSummary } from "@/lib/types";

/**
 * A mensagem otimista precisa sair da tela quando o banco confirma.
 *
 * A mensagem aparece antes de o banco responder e some sozinha depois. O que
 * amarra as duas é o id temporário: o compositor guarda o id que `onPending`
 * devolve, e é por ele que a mensagem sai quando a Action termina.
 *
 * Quando esse id não era guardado, o efeito de conclusão não tinha o que
 * confirmar, `onSettled` nunca era chamado e a mensagem otimista ficava na tela
 * para sempre — a pessoa via a mensagem duplicada assim que a versão real
 * chegava pelo Realtime, e o campo de texto nunca esvaziava.
 */

const { sendMessageAction } = vi.hoisted(() => ({ sendMessageAction: vi.fn() }));

vi.mock("@/app/actions/messages", () => ({ sendMessageAction }));

const { MessageComposer } = await import("@/components/messages/message-composer");

const autumn = {
  id: "aaaaaaa1-0000-4000-8000-000000000001",
  entity_id: "c1",
  display_name: "Autumn",
  username: "autumn",
  avatar_url: null,
  banner_url: null,
  avatar_position_x: 50,
  avatar_position_y: 50,
  banner_position_y: 50,
  entity_type: "character" as const,
  is_npc: false,
  organization_type: null,
};

const mad = {
  ...autumn,
  id: "bbbbbbb2-0000-4000-8000-000000000002",
  display_name: "Mad",
  username: "mad",
  is_npc: true,
};

const conversationId = "ddddddd4-0000-4000-8000-000000000004";

afterEach(() => {
  cleanup();
  sendMessageAction.mockReset();
});

function setup(overrides: Partial<React.ComponentProps<typeof MessageComposer>> = {}) {
  const onPending = vi.fn<(sender: ActorSummary, content: string) => string>(() => "optimistic-1");
  const onSettled = vi.fn();
  const { container, rerender } = render(
    <MessageComposer
      conversationId={conversationId}
      speakers={[autumn, mad]}
      activeActorId={autumn.id}
      onPending={onPending}
      onSettled={onSettled}
      {...overrides}
    />,
  );
  const root = { rerender };
  return {
    container,
    textarea: container.querySelector("textarea")!,
    form: container.querySelector("form")!,
    onPending,
    onSettled,
    rerender: (next: React.ReactElement) => root.rerender(next),
  };
}

function send(text: string) {
  return (target: { textarea: HTMLTextAreaElement; form: HTMLFormElement }) => {
    fireEvent.change(target.textarea, { target: { value: text } });
    fireEvent.submit(target.form);
  };
}

describe("compositor de mensagens", () => {
  it("guarda o id devolvido por onPending ao enviar", async () => {
    sendMessageAction.mockResolvedValue({ ok: true });
    const target = setup();

    send("olá")(target);

    await waitFor(() => expect(target.onPending).toHaveBeenCalledTimes(1));
    // O compositor precisa do id devolvido; sem ele a mensagem não tem como sair.
    expect(target.onPending.mock.results[0]?.value).toBe("optimistic-1");
  });

  it("confirma a mensagem otimista quando a Action termina", async () => {
    sendMessageAction.mockResolvedValue({ ok: true });
    const target = setup();

    send("olá")(target);

    // É esta chamada que desfaz a duplicata: sem ela a mensagem otimista fica
    // na tela e aparece de novo quando a versão real chega pelo Realtime.
    await waitFor(() => expect(target.onSettled).toHaveBeenCalledWith(true, "optimistic-1"));
  });

  it("esvazia o campo depois de enviar", async () => {
    sendMessageAction.mockResolvedValue({ ok: true });
    const target = setup();

    send("olá")(target);

    // Quem esvazia é o React, que reseta o formulário uncontrolled quando a action
    // de formulário termina. A limpeza explícita é só uma garantia a mais.
    await waitFor(() => expect(target.textarea.value).toBe(""));
  });

  it("tira a mensagem da tela e avisa quando o banco recusa", async () => {
    sendMessageAction.mockResolvedValue({ ok: false, message: "Você não participa dessa conversa." });
    const target = setup();

    send("olá")(target);

    await waitFor(() => expect(target.onSettled).toHaveBeenCalledWith(false, "optimistic-1"));
    // A recusa aparece; a mensagem otimista sai, para não fingir que foi enviada.
    expect(target.container.textContent).toContain("Você não participa dessa conversa.");
  });

  it("envia com o personagem escolhido, não com o ativo", async () => {
    sendMessageAction.mockResolvedValue({ ok: true });
    const target = setup();

    fireEvent.change(target.container.querySelector("select")!, { target: { value: mad.id } });
    send("falando como npc")(target);

    await waitFor(() => expect(target.onSettled).toHaveBeenCalled());
    expect(target.onPending.mock.calls[0]?.[0].id).toBe(mad.id);
  });

  it("não deixa enviar sem texto", () => {
    sendMessageAction.mockResolvedValue({ ok: true });
    const target = setup();

    send("   ")(target);

    expect(target.onPending).not.toHaveBeenCalled();
  });
});

describe("trocar de personagem no meio da digitação", () => {
  it("envia com a voz que estava na tela, não com a que chegou depois", async () => {
    sendMessageAction.mockResolvedValue({ ok: true });
    const target = setup();

    // A pessoa começa a digitar como Autumn...
    fireEvent.change(target.textarea, { target: { value: "olá" } });
    // ...e enquanto escreve, troca de personagem no menu do shell.
    target.rerender(
      <MessageComposer
        conversationId={conversationId}
        speakers={[autumn, mad]}
        activeActorId={mad.id}
        onPending={target.onPending}
        onSettled={target.onSettled}
      />,
    );
    fireEvent.submit(target.form);

    // Sem a trava, o `senderActorId` mudaria por baixo da digitação: a tela
    // mostrava Autumn e a mensagem saía como Mad.
    expect(target.onPending.mock.calls[0]?.[0].id).toBe(autumn.id);
  });

  it("a mensagem seguinte volta a acompanhar a identidade ativa", async () => {
    sendMessageAction.mockResolvedValue({ ok: true });
    const target = setup();

    fireEvent.change(target.textarea, { target: { value: "primeira" } });
    fireEvent.submit(target.form);
    await waitFor(() => expect(target.onSettled).toHaveBeenCalled());

    // A troca no shell aconteceu; a próxima mensagem é da nova voz.
    target.rerender(
      <MessageComposer
        conversationId={conversationId}
        speakers={[autumn, mad]}
        activeActorId={mad.id}
        onPending={target.onPending}
        onSettled={target.onSettled}
      />,
    );
    send("segunda")(target);

    // A trava vale entre o foco e o envio, não para sempre: senão a segunda
    // mensagem sairia com a voz da primeira.
    expect(target.onPending.mock.calls[1]?.[0].id).toBe(mad.id);
  });
});
