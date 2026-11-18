import { ComponentRegistry, WorkspaceStore } from 'mailspring-exports';
import AccountSidebar from './components/account-sidebar';
import AppBrand from './components/app-brand';
import { SidebarToggle, TopBarActions, TopBarActionsInReader } from './components/top-bar-items';
import { activateMboxExportRunner, deactivateMboxExportRunner } from './mbox-export-runner';

export function activate(state) {
  ComponentRegistry.register(AccountSidebar, { location: WorkspaceStore.Location.RootSidebar });
  ComponentRegistry.register(SidebarToggle, {
    location: WorkspaceStore.Location.RootSidebar.Toolbar,
  });
  ComponentRegistry.register(AppBrand, { location: WorkspaceStore.Location.RootSidebar.Toolbar });
  ComponentRegistry.register(TopBarActions, {
    location: WorkspaceStore.Location.ThreadList.Toolbar,
    modes: ['list'],
  });
  ComponentRegistry.register(TopBarActionsInReader, {
    location: WorkspaceStore.Location.MessageList.Toolbar,
  });
  activateMboxExportRunner();
}

export function deactivate(state) {
  ComponentRegistry.unregister(AccountSidebar);
  ComponentRegistry.unregister(AppBrand);
  ComponentRegistry.unregister(SidebarToggle);
  ComponentRegistry.unregister(TopBarActions);
  ComponentRegistry.unregister(TopBarActionsInReader);
  deactivateMboxExportRunner();
}
