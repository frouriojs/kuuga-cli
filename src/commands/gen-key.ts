import { keys } from '@libp2p/crypto';
import { peerIdFromPrivateKey } from '@libp2p/peer-id';
import fs from 'fs/promises';
import path from 'path';

export async function genKey(outputPath?: string): Promise<void> {
  try {
    const privateKey = await keys.generateKeyPair('Ed25519');
    const peerId = peerIdFromPrivateKey(privateKey);

    const peerIdData = {
      id: peerId.toString(),
      privKey: Buffer.from(keys.privateKeyToProtobuf(privateKey)).toString('base64'),
      pubKey: Buffer.from(privateKey.publicKey.raw).toString('base64'),
    };

    const savePath = outputPath || 'peer-id.json';
    const absolutePath = path.resolve(savePath);

    await fs.writeFile(absolutePath, JSON.stringify(peerIdData, null, 2));

    console.log(`Peer ID generated and saved to: ${absolutePath}`);
    console.log(`Peer ID: ${peerIdData.id}`);
  } catch (error) {
    console.error('Error generating peer ID:', error);
    process.exit(1);
  }
}
