export const idlFactory = ({ IDL }) => {
  const ToolCallArgument = IDL.Record({
    'value' : IDL.Text,
    'name' : IDL.Text,
  });
  const FunctionCall = IDL.Record({
    'name' : IDL.Text,
    'arguments' : IDL.Vec(ToolCallArgument),
  });
  const ToolCall = IDL.Record({ 'id' : IDL.Text, 'function' : FunctionCall });
  const AssistantMessage = IDL.Record({
    'content' : IDL.Opt(IDL.Text),
    'tool_calls' : IDL.Vec(ToolCall),
  });
  const ChatMessage = IDL.Variant({
    'tool' : IDL.Record({ 'content' : IDL.Text, 'tool_call_id' : IDL.Text }),
    'user' : IDL.Record({ 'content' : IDL.Text }),
    'assistant' : AssistantMessage,
    'system' : IDL.Record({ 'content' : IDL.Text }),
  });
  const SavedAccount = IDL.Record({
    'alias' : IDL.Text,
    'owner' : IDL.Principal,
    'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
  });
  const Result = IDL.Variant({ 'Ok' : IDL.Null, 'Err' : IDL.Text });
  return IDL.Service({
    'copilot_chat' : IDL.Func([IDL.Vec(ChatMessage)], [IDL.Text], []),
    'list_accounts' : IDL.Func([], [IDL.Vec(SavedAccount)], ['query']),
    'save_account' : IDL.Func(
        [IDL.Text, IDL.Text, IDL.Opt(IDL.Vec(IDL.Nat8))],
        [Result],
        [],
      ),
  });
};
export const init = ({ IDL }) => { return []; };
