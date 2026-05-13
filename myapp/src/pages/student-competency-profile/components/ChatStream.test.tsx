import { fireEvent, render, screen } from "@testing-library/react";
import type { WorkspaceMessage } from "../shared";
import { ChatStream } from "./ChatStream";

const makeMessage = (
  overrides: Partial<WorkspaceMessage> = {}
): WorkspaceMessage => ({
  id: "msg-1",
  role: "assistant",
  kind: "chat",
  content: "Hello",
  createdAt: "2024-01-01T00:00:00Z",
  status: "completed",
  ...overrides,
});

describe("ChatStream", () => {
  it("renders the chat container", () => {
    render(
      <ChatStream messages={[]} isStreaming={false} onSendText={jest.fn()} />
    );
    expect(screen.getByTestId("chat-stream")).toBeTruthy();
  });

  it("renders user messages", () => {
    const messages = [makeMessage({ id: "u1", role: "user", content: "你好" })];
    render(
      <ChatStream
        messages={messages}
        isStreaming={false}
        onSendText={jest.fn()}
      />
    );
    expect(screen.getByTestId("chat-bubble-user").textContent).toBe("你好");
  });

  it("renders assistant messages", () => {
    const messages = [
      makeMessage({ id: "a1", role: "assistant", content: "解析中..." }),
    ];
    render(
      <ChatStream
        messages={messages}
        isStreaming={false}
        onSendText={jest.fn()}
      />
    );
    expect(screen.getByTestId("chat-bubble-assistant").textContent).toBe(
      "解析中..."
    );
  });

  it("renders error messages", () => {
    const messages = [
      makeMessage({
        id: "e1",
        role: "assistant",
        content: "解析失败",
        status: "error",
      }),
    ];
    render(
      <ChatStream
        messages={messages}
        isStreaming={false}
        onSendText={jest.fn()}
      />
    );
    expect(screen.getByTestId("chat-bubble-error").textContent).toBe(
      "解析失败"
    );
  });

  it("renders result messages", () => {
    const messages = [
      makeMessage({
        id: "r1",
        role: "assistant",
        kind: "result",
        content: "解析结果已生成",
        status: "completed",
      }),
    ];
    render(
      <ChatStream
        messages={messages}
        isStreaming={false}
        onSendText={jest.fn()}
      />
    );
    expect(screen.getByTestId("chat-bubble-result").textContent).toBe(
      "解析结果已生成"
    );
  });

  it("shows stage label when streaming with stage", () => {
    const messages = [
      makeMessage({
        id: "s1",
        role: "assistant",
        content: "解析中",
        status: "streaming",
        stage: "analyze",
      }),
    ];
    render(
      <ChatStream
        messages={messages}
        isStreaming={false}
        onSendText={jest.fn()}
      />
    );
    expect(screen.getByText("analyze")).toBeTruthy();
  });

  it('shows "思考中..." for empty streaming message', () => {
    const messages = [
      makeMessage({
        id: "p1",
        role: "assistant",
        content: "",
        status: "streaming",
      }),
    ];
    render(
      <ChatStream
        messages={messages}
        isStreaming={false}
        onSendText={jest.fn()}
      />
    );
    expect(screen.getByText("思考中...")).toBeTruthy();
  });

  it("shows placeholder when not streaming", () => {
    render(
      <ChatStream messages={[]} isStreaming={false} onSendText={jest.fn()} />
    );
    expect(screen.getByPlaceholderText("输入补充信息...")).toBeTruthy();
  });

  it("shows disabled placeholder when streaming", () => {
    render(
      <ChatStream messages={[]} isStreaming={true} onSendText={jest.fn()} />
    );
    const input = screen.getByPlaceholderText("正在解析中...");
    expect(input).toBeTruthy();
    expect((input as HTMLInputElement).disabled).toBe(true);
  });

  it("calls onSendFile when appending a file", () => {
    const onSendFile = jest.fn();
    const { container } = render(
      <ChatStream
        messages={[]}
        isStreaming={false}
        onSendText={jest.fn()}
        onSendFile={onSendFile}
      />
    );
    const fileInput = container.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const file = new File(["resume"], "resume.pdf", {
      type: "application/pdf",
    });

    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(onSendFile).toHaveBeenCalledWith(file);
  });

  it("calls onSendText on Enter key", () => {
    const onSendText = jest.fn();
    render(
      <ChatStream messages={[]} isStreaming={false} onSendText={onSendText} />
    );
    const input = screen.getByPlaceholderText("输入补充信息...");
    fireEvent.change(input, { target: { value: "请解析简历" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSendText).toHaveBeenCalledWith("请解析简历");
  });

  it("does not send on Shift+Enter", () => {
    const onSendText = jest.fn();
    render(
      <ChatStream messages={[]} isStreaming={false} onSendText={onSendText} />
    );
    const input = screen.getByPlaceholderText("输入补充信息...");
    fireEvent.change(input, { target: { value: "多行文本" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(onSendText).not.toHaveBeenCalled();
  });

  it("does not send empty text", () => {
    const onSendText = jest.fn();
    render(
      <ChatStream messages={[]} isStreaming={false} onSendText={onSendText} />
    );
    const input = screen.getByPlaceholderText("输入补充信息...");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSendText).not.toHaveBeenCalled();
  });

  it("skips rendering empty completed non-result messages", () => {
    const messages = [
      makeMessage({
        id: "empty-status",
        role: "assistant",
        kind: "status",
        content: "",
        status: "completed",
      }),
      makeMessage({
        id: "result-msg",
        role: "assistant",
        kind: "result",
        content: "解析结果已生成",
        status: "completed",
      }),
    ];
    render(
      <ChatStream
        messages={messages}
        isStreaming={false}
        onSendText={jest.fn()}
      />
    );
    // The empty status message should not render a bubble
    expect(screen.queryByTestId("chat-bubble-assistant")).toBeNull();
    // The result message should still render
    expect(screen.getByTestId("chat-bubble-result")).toBeTruthy();
  });
});
