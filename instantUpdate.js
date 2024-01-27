module.exports = async function() {
    const got = require('got');
    const chalk = require('chalk');
    const error = chalk.bold.red;
    const warning = chalk.hex('#FFA500');
    const success = chalk.greenBright;
    const { execSync } = require('child_process');
    const { body } = await got('https://raw.githubusercontent.com/ivancotacte/fca-orion-api/main/data/fcaVersion.json');
    const json = JSON.parse(body);
    const LocalVersion = require('./package.json').version;
        if (Number(LocalVersion.replace(/\./g,"")) < Number(json.Version.replace(/\./g,"")) ) {
            console.log(warning(`[ FCA-UPDATE ] `) + chalk.white("To avoid errors, update FCA-ORIONS: " + LocalVersion + " -> " + json.Version));
            console.log(warning(`[ FCA-UPDATE ] `) + chalk.white("Problem Description: " + json.Problem));
            console.log(warning("[ FCA-UPDATE ] ") + chalk.white("Please contact to owner about update failed and screentshot error log at https://www.facebook.com/icotacteeee"));
            await new Promise(resolve => setTimeout(resolve, 3000));
            try {
                execSync(`npm install fca-orion-api@${json.Version}`, { stdio: 'inherit' });
                console.log(success("[ FCA-UPDATE ] ","Update Complete, Restarting..."));
                await new Promise(resolve => setTimeout(resolve, 3000));
                process.exit(1);
            } catch (err) {
                try {
                    console.log(error("[ FCA-UPDATE ] ") + chalk.white("Update Failed, Trying Another Method 1..."));
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    execSync(`npm install fca-orion-api@${json.Version} --force`, { stdio: 'inherit' });
                    console.log(success("[ FCA-UPDATE ] ","Update Complete, Restarting..."));
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    process.exit(1);
                } catch (err) {
                    console.log(e);
                    console.log(warning("[ FCA-UPDATE ] ") + chalk.white("Update Failed, Please Update Manually"));
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    console.log(warning("[ FCA-UPDATE ] ") + chalk.white("Please contact to owner about update failed and screentshot error log at https://www.facebook.com/icotacteeee"));
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    process.exit(1);
                }
            }
        } else {
        }
}