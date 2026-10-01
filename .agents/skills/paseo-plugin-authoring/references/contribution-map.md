# Contribution selection

Source: https://paseo.sh/docs/plugins/reference. Checked 2026-09-29.

| User goal                         | Smallest contribution                                          | Runtime and dependencies                                                               |
| --------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Global page                       | `addSurface` then `addSidebarItem`                             | Client; host props and React Native                                                    |
| Workspace tab or Explorer         | `addWorkspacePanel`, `context: "workspace"`                    | Client; `useWorkspace(id, selector)`                                                   |
| Agent detail                      | `addWorkspacePanel`, `context: "agent"`                        | Client; `useAgent(id, selector)`                                                       |
| Searchable action                 | `addCommandCenterItem`                                         | Client; exact global/workspace/agent context                                           |
| `/name args`                      | `addSlashCommand`                                              | Client; workspace or agent context, no server slash API                                |
| Persistent action trigger         | `addHeaderButton` or `addComposerPill`                         | Client; target IDs, button descriptor and handle cleanup                               |
| Render custom history             | `addTimelineRenderer`                                          | Client; shared schema, kind and version                                                |
| Replace a built-in row            | `addTimelineTransformer` plus renderer                         | Client; pure synchronous transformation                                                |
| Backend progress row              | `paseo.agents.ref(id).timeline.append` plus renderer           | Server and client; feature availability, JSON size                                     |
| Attach vendor resource            | `defineAttachmentSource`, RPC handler, `addAttachmentSource`   | Shared contract, server credentials, client registration                               |
| Settings screen                   | `addSettingsScreen`                                            | Client; add shared `defineSettings` and server `registerSettings` only for persistence |
| Appearance palette                | `addTheme`                                                     | Client-only data                                                                       |
| File/vendor/credential operation  | `defineRpc`, `server.handle`, `useRpc`                         | Shared schema, server handler, client caller                                           |
| Observe lifecycle                 | `server.on`                                                    | Server; live best-effort event                                                         |
| Alter explicit creation or launch | `server.before`                                                | Server; returned request, bounded callback                                             |
| Supply an agent                   | `registerProvider`, preferably `runAcpProvider` if already ACP | Server; protocol and executable, SVG asset                                             |
| Report account quota              | `registerUsageSource`                                          | Server; 0.9.3 SDK and runtime                                                          |

Normal SDK work needs no extra RPC. A settings screen using its own local draft needs no server until persisted host values are requested. A renderer needs no provider. A server-only hook needs no client entry. Combine only registrations required by the goal.
