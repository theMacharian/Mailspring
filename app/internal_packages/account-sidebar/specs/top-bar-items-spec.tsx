import React from 'react';
import ReactDOM from 'react-dom';
import ReactTestUtils from 'react-dom/test-utils';
import { SidebarToggle } from '../lib/components/top-bar-items';

describe('SidebarToggle', function () {
  afterEach(function () {
    AppEnv.config.set('core.workspace.foldersCollapsed', false);
    document.body.classList.remove('folders-collapsed');
  });

  it('collapses and expands the folder list', function () {
    AppEnv.config.set('core.workspace.foldersCollapsed', false);
    const container = document.createElement('div');
    ReactDOM.render(<SidebarToggle />, container);
    const button = () => container.querySelector('button');

    ReactTestUtils.Simulate.click(button());
    expect(AppEnv.config.get('core.workspace.foldersCollapsed')).toBe(true);

    ReactTestUtils.Simulate.click(button());
    expect(AppEnv.config.get('core.workspace.foldersCollapsed')).toBe(false);
  });
});
