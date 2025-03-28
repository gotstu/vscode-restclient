import * as vscode from 'vscode';
import { trace } from "../utils/decorator";
import * as fs from 'fs';
import * as path from 'path';
import * as Constants from '../common/constants';
import { QuickPickItem } from 'vscode';
import { SystemSettings } from '../models/configurationSettings';
import { UserDataManager } from '../utils/userDataManager';
import { initLogger, log } from "../utils/logger";
import { LogLevel } from "../types";

type EnvironmentPickItem = QuickPickItem & { name: string };

export class HttpTestingController {
    
    private static readonly noEnvironmentPickItem: EnvironmentPickItem = {
        label: 'No Environment',
        name: Constants.NoEnvironmentSelectedName,
        description: 'You can still use variables defined in the $shared environment'
    };
    private readonly settings: SystemSettings = SystemSettings.Instance;
    // Helper function to filter out auto_fetch_token_data
    private filterEnvironmentVars(vars: any): any {
        const filtered = { ...vars };
        delete filtered.auto_fetch_token_data;
        return filtered;
    }

    // Create output channel
    private static readonly outputChannel = vscode.window.createOutputChannel('REST Client');

    constructor() {
        // Initialize logger with the output channel
        initLogger(HttpTestingController.outputChannel);
    }

    @trace('HTTP Testing')
    public async runHttpTest() {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            log('No active editor found.', LogLevel.ERROR);
            vscode.window.showErrorMessage('No active editor found.');
            return;
        }

        const document = activeEditor.document;
        const fileName = document.fileName;

        if (!fileName.endsWith('.http')) {
            log('The active file is not an .http file.', LogLevel.ERROR);
            vscode.window.showErrorMessage('The active file is not an .http file.');
            return;
        }

        try {
            log('Creating variables.json...', LogLevel.INFO);
            
            // Get current environment
            const currentEnvironment = await HttpTestingController.getCurrentEnvironment();
            log(`Current environment: ${currentEnvironment.name}`, LogLevel.INFO);

            // Merge $shared and current environment variables, excluding auto_fetch_token_data
            const sharedVars = this.filterEnvironmentVars(this.settings.environmentVariables['$shared'] || {});
            const currentEnvVars = currentEnvironment.name !== Constants.NoEnvironmentSelectedName
                ? this.filterEnvironmentVars(this.settings.environmentVariables[currentEnvironment.name] || {})
                : {};

            // Combine variables with current environment taking precedence
            const combinedVars = {
                ...sharedVars,
                ...currentEnvVars
            };

            // Create variables.json with combined values
            const variablesPath = path.join(path.dirname(fileName), 'variables.json');
            await fs.promises.writeFile(
                variablesPath,
                JSON.stringify(combinedVars, null, 2),
                'utf8'
            );
            log(`Variables written to: ${variablesPath}`, LogLevel.INFO);

            log("Starting test run...", LogLevel.INFO);

        } catch (error) {
            log(`Failed to create variables.json: ${error instanceof Error ? error.message : String(error)}`, LogLevel.ERROR);
            vscode.window.showErrorMessage(`Failed to create variables.json: ${error instanceof Error ? error.message : String(error)}`);
            return;
        }
    }

    public static async create(): Promise<HttpTestingController> {
        return new HttpTestingController();
    }

    private static async getCurrentEnvironment(): Promise<EnvironmentPickItem> {
        const currentEnvironment = await UserDataManager.getEnvironment() as EnvironmentPickItem | undefined;
        return currentEnvironment || this.noEnvironmentPickItem;
    }
}