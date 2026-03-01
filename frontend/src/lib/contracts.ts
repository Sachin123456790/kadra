// ---------------------------------------------------------------------------
// Contract ABIs and bytecodes extracted from Hardhat compilation artifacts.
// Source contracts:
//   - contracts/IdentityRegistry.sol
//   - contracts/KadraToken.sol
//   - contracts/DocumentRegistry.sol
// ---------------------------------------------------------------------------

// ---- IdentityRegistry -------------------------------------------------------

export const IdentityRegistryABI = [
  {
    inputs: [],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "owner",
        type: "address",
      },
    ],
    name: "OwnableInvalidOwner",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "account",
        type: "address",
      },
    ],
    name: "OwnableUnauthorizedAccount",
    type: "error",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "investor",
        type: "address",
      },
      {
        indexed: false,
        internalType: "bool",
        name: "eligible",
        type: "bool",
      },
    ],
    name: "EligibilityChanged",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "investor",
        type: "address",
      },
    ],
    name: "InvestorAdded",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "investor",
        type: "address",
      },
    ],
    name: "InvestorRemoved",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "previousOwner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "newOwner",
        type: "address",
      },
    ],
    name: "OwnershipTransferred",
    type: "event",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "investor",
        type: "address",
      },
    ],
    name: "addInvestor",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    name: "isEligible",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "investor",
        type: "address",
      },
    ],
    name: "isEligibleLP",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    name: "isVerified",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "investor",
        type: "address",
      },
    ],
    name: "removeInvestor",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "renounceOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "investor",
        type: "address",
      },
      {
        internalType: "bool",
        name: "eligible",
        type: "bool",
      },
    ],
    name: "setEligibility",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "newOwner",
        type: "address",
      },
    ],
    name: "transferOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

export const IdentityRegistryBytecode: `0x${string}` =
  "0x608060405234801561001057600080fd5b5033600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff16036100845760006040517f1e4fbdf700000000000000000000000000000000000000000000000000000000815260040161007b919061019e565b60405180910390fd5b6100938161009960201b60201c565b506101b9565b60008060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff169050816000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055508173ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff167f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e060405160405180910390a35050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b60006101888261015d565b9050919050565b6101988161017d565b82525050565b60006020820190506101b3600083018461018f565b92915050565b6108a7806101c86000396000f3fe608060405234801561001057600080fd5b50600436106100935760003560e01c80638da5cb5b116100665780638da5cb5b1461010a578063b9209e3314610128578063e641bde114610158578063f2fde38b14610174578063f982b0991461019057610093565b80632d63294d1461009857806342714978146100b457806366e305fd146100d0578063715018a614610100575b600080fd5b6100b260048036038101906100ad91906107b0565b6101c0565b005b6100ce60048036038101906100c991906107f0565b610271565b005b6100ea60048036038101906100e591906107f0565b61036f565b6040516100f7919061082c565b60405180910390f35b61010861038f565b005b6101126103a3565b60405161011f9190610856565b60405180910390f35b610142600480360381019061013d91906107f0565b6103cc565b60405161014f919061082c565b60405180910390f35b610172600480360381019061016d91906107f0565b6103ec565b005b61018e600480360381019061018991906107f0565b610491565b005b6101aa60048036038101906101a591906107f0565b610517565b6040516101b7919061082c565b60405180910390f35b6101c86105c2565b80600260008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060006101000a81548160ff0219169083151502179055508173ffffffffffffffffffffffffffffffffffffffff167f6ae14d48df6afe3cad37dc9d491e4040245b769277746a4fbfe211807db7156882604051610265919061082c565b60405180910390a25050565b6102796105c2565b6000600160008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060006101000a81548160ff0219169083151502179055506000600260008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060006101000a81548160ff0219169083151502179055508073ffffffffffffffffffffffffffffffffffffffff167fba0013628ccb89af5bb18edf764d3a7b35c07b894848b8e6fd3434719de39c7d60405160405180910390a250565b60026020528060005260406000206000915054906101000a900460ff1681565b6103976105c2565b6103a16000610649565b565b60008060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905090565b60016020528060005260406000206000915054906101000a900460ff1681565b6103f46105c2565b60018060008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060006101000a81548160ff0219169083151502179055508073ffffffffffffffffffffffffffffffffffffffff167f62e6a5118be03f9bfedb79b0ed7ed75ee4a9e15fc4c69d2c4976acde26fa2d5f60405160405180910390a250565b6104996105c2565b600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff160361050b5760006040517f1e4fbdf70000000000000000000000000000000000000000000000000000000081526004016105029190610856565b60405180910390fd5b61051481610649565b50565b6000600160008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060009054906101000a900460ff1680156105bb5750600260008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060009054906101000a900460ff165b9050919050565b6105ca61070d565b73ffffffffffffffffffffffffffffffffffffffff166105e86103a3565b73ffffffffffffffffffffffffffffffffffffffff16146106475761060b61070d565b6040517f118cdaa700000000000000000000000000000000000000000000000000000000815260040161063e9190610856565b60405180910390fd5b565b60008060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff169050816000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055508173ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff167f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e060405160405180910390a35050565b600033905090565b600080fd5b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b60006107458261071a565b9050919050565b6107558161073a565b811461076057600080fd5b50565b6000813590506107728161074c565b92915050565b60008115159050919050565b61078d81610778565b811461079857600080fd5b50565b6000813590506107aa81610784565b92915050565b600080604083850312156107c7576107c6610715565b5b60006107d585828601610763565b92505060206107e68582860161079b565b9150509250929050565b60006020828403121561080657610805610715565b5b600061081484828501610763565b91505092915050565b61082681610778565b82525050565b6000602082019050610841600083018461081d565b92915050565b6108508161073a565b82525050565b600060208201905061086b6000830184610847565b9291505056fea2646970667358221220ed0bc66a3853611b3b2459f849f528bc07bf41a8e573d81ea50910465171b0b364736f6c63430008180033";

// ---- KadraToken -------------------------------------------------------------

export const KadraTokenABI = [
  {
    inputs: [
      {
        internalType: "string",
        name: "name",
        type: "string",
      },
      {
        internalType: "string",
        name: "symbol",
        type: "string",
      },
      {
        internalType: "address",
        name: "_identityRegistry",
        type: "address",
      },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "spender",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "allowance",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "needed",
        type: "uint256",
      },
    ],
    name: "ERC20InsufficientAllowance",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "sender",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "balance",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "needed",
        type: "uint256",
      },
    ],
    name: "ERC20InsufficientBalance",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "approver",
        type: "address",
      },
    ],
    name: "ERC20InvalidApprover",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "receiver",
        type: "address",
      },
    ],
    name: "ERC20InvalidReceiver",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "sender",
        type: "address",
      },
    ],
    name: "ERC20InvalidSender",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "spender",
        type: "address",
      },
    ],
    name: "ERC20InvalidSpender",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "owner",
        type: "address",
      },
    ],
    name: "OwnableInvalidOwner",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "account",
        type: "address",
      },
    ],
    name: "OwnableUnauthorizedAccount",
    type: "error",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "owner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "spender",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "value",
        type: "uint256",
      },
    ],
    name: "Approval",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "previousOwner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "newOwner",
        type: "address",
      },
    ],
    name: "OwnershipTransferred",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "from",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "to",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "value",
        type: "uint256",
      },
    ],
    name: "Transfer",
    type: "event",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "owner",
        type: "address",
      },
      {
        internalType: "address",
        name: "spender",
        type: "address",
      },
    ],
    name: "allowance",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "spender",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "value",
        type: "uint256",
      },
    ],
    name: "approve",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "account",
        type: "address",
      },
    ],
    name: "balanceOf",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [
      {
        internalType: "uint8",
        name: "",
        type: "uint8",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "identityRegistry",
    outputs: [
      {
        internalType: "contract IIdentityRegistry",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "to",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "mint",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "name",
    outputs: [
      {
        internalType: "string",
        name: "",
        type: "string",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "renounceOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [
      {
        internalType: "string",
        name: "",
        type: "string",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalSupply",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "to",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "value",
        type: "uint256",
      },
    ],
    name: "transfer",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "from",
        type: "address",
      },
      {
        internalType: "address",
        name: "to",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "value",
        type: "uint256",
      },
    ],
    name: "transferFrom",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "newOwner",
        type: "address",
      },
    ],
    name: "transferOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

export const KadraTokenBytecode: `0x${string}` =
  "0x60806040523480156200001157600080fd5b5060405162001e2038038062001e208339818101604052810190620000379190620003ef565b33838381600390816200004b9190620006d4565b5080600490816200005d9190620006d4565b505050600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff1603620000d55760006040517f1e4fbdf7000000000000000000000000000000000000000000000000000000008152600401620000cc9190620007cc565b60405180910390fd5b620000e6816200013160201b60201c565b5080600660006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff160217905550505050620007e9565b6000600560009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905081600560006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055508173ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff167f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e060405160405180910390a35050565b6000604051905090565b600080fd5b600080fd5b600080fd5b600080fd5b6000601f19601f8301169050919050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b620002608262000215565b810181811067ffffffffffffffff8211171562000282576200028162000226565b5b80604052505050565b600062000297620001f7565b9050620002a5828262000255565b919050565b600067ffffffffffffffff821115620002c857620002c762000226565b5b620002d38262000215565b9050602081019050919050565b60005b8381101562000300578082015181840152602081019050620002e3565b60008484015250505050565b6000620003236200031d84620002aa565b6200028b565b90508281526020810184848401111562000342576200034162000210565b5b6200034f848285620002e0565b509392505050565b600082601f8301126200036f576200036e6200020b565b5b8151620003818482602086016200030c565b91505092915050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b6000620003b7826200038a565b9050919050565b620003c981620003aa565b8114620003d557600080fd5b50565b600081519050620003e981620003be565b92915050565b6000806000606084860312156200040b576200040a62000201565b5b600084015167ffffffffffffffff8111156200042c576200042b62000206565b5b6200043a8682870162000357565b935050602084015167ffffffffffffffff8111156200045e576200045d62000206565b5b6200046c8682870162000357565b92505060406200047f86828701620003d8565b9150509250925092565b600081519050919050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052602260045260246000fd5b60006002820490506001821680620004dc57607f821691505b602082108103620004f257620004f162000494565b5b50919050565b60008190508160005260206000209050919050565b60006020601f8301049050919050565b600082821b905092915050565b6000600883026200055c7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff826200051d565b6200056886836200051d565b95508019841693508086168417925050509392505050565b6000819050919050565b6000819050919050565b6000620005b5620005af620005a98462000580565b6200058a565b62000580565b9050919050565b6000819050919050565b620005d18362000594565b620005e9620005e082620005bc565b8484546200052a565b825550505050565b600090565b62000600620005f1565b6200060d818484620005c6565b505050565b5b81811015620006355762000629600082620005f6565b60018101905062000613565b5050565b601f82111562000684576200064e81620004f8565b62000659846200050d565b8101602085101562000669578190505b6200068162000678856200050d565b83018262000612565b50505b505050565b600082821c905092915050565b6000620006a96000198460080262000689565b1980831691505092915050565b6000620006c4838362000696565b9150826002028217905092915050565b620006df8262000489565b67ffffffffffffffff811115620006fb57620006fa62000226565b5b620007078254620004c3565b6200071482828562000639565b600060209050601f8311600181146200074c576000841562000737578287015190505b620007438582620006b6565b865550620007b3565b601f1984166200075c86620004f8565b60005b8281101562000786578489015182556001820191506020850194506020810190506200075f565b86831015620007a65784890151620007a2601f89168262000696565b8355505b6001600288020188555050505b505050505050565b620007c681620003aa565b82525050565b6000602082019050620007e36000830184620007bb565b92915050565b61162780620007f96000396000f3fe608060405234801561001057600080fd5b50600436106100ea5760003560e01c806370a082311161008c57806395d89b411161006657806395d89b411461023b578063a9059cbb14610259578063dd62ed3e14610289578063f2fde38b146102b9576100ea565b806370a08231146101e3578063715018a6146102135780638da5cb5b1461021d576100ea565b806318160ddd116100c857806318160ddd1461015b57806323b872dd14610179578063313ce567146101a957806340c10f19146101c7576100ea565b806306fdde03146100ef578063095ea7b31461010d578063134e18f41461013d575b600080fd5b6100f76102d5565b6040516101049190611084565b60405180910390f35b6101276004803603810190610122919061113f565b610367565b604051610134919061119a565b60405180910390f35b61014561038a565b6040516101529190611214565b60405180910390f35b6101636103b0565b604051610170919061123e565b60405180910390f35b610193600480360381019061018e9190611259565b6103ba565b6040516101a0919061119a565b60405180910390f35b6101b16103e9565b6040516101be91906112c8565b60405180910390f35b6101e160048036038101906101dc919061113f565b6103f2565b005b6101fd60048036038101906101f891906112e3565b610408565b60405161020a919061123e565b60405180910390f35b61021b610450565b005b610225610464565b604051610232919061131f565b60405180910390f35b61024361048e565b6040516102509190611084565b60405180910390f35b610273600480360381019061026e919061113f565b610520565b604051610280919061119a565b60405180910390f35b6102a3600480360381019061029e919061133a565b610543565b6040516102b0919061123e565b60405180910390f35b6102d360048036038101906102ce91906112e3565b6105ca565b005b6060600380546102e4906113a9565b80601f0160208091040260200160405190810160405280929190818152602001828054610310906113a9565b801561035d5780601f106103325761010080835404028352916020019161035d565b820191906000526020600020905b81548152906001019060200180831161034057829003601f168201915b5050505050905090565b600080610372610650565b905061037f818585610658565b600191505092915050565b600660009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b6000600254905090565b6000806103c5610650565b90506103d285828561066a565b6103dd8585856106ff565b60019150509392505050565b60006012905090565b6103fa6107f3565b610404828261087a565b5050565b60008060008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020549050919050565b6104586107f3565b61046260006108fc565b565b6000600560009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905090565b60606004805461049d906113a9565b80601f01602080910402602001604051908101604052809291908181526020018280546104c9906113a9565b80156105165780601f106104eb57610100808354040283529160200191610516565b820191906000526020600020905b8154815290600101906020018083116104f957829003601f168201915b5050505050905090565b60008061052b610650565b90506105388185856106ff565b600191505092915050565b6000600160008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054905092915050565b6105d26107f3565b600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff16036106445760006040517f1e4fbdf700000000000000000000000000000000000000000000000000000000815260040161063b919061131f565b60405180910390fd5b61064d816108fc565b50565b600033905090565b61066583838360016109c2565b505050565b60006106768484610543565b90507fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff8110156106f957818110156106e9578281836040517ffb8f41b20000000000000000000000000000000000000000000000000000000081526004016106e0939291906113da565b60405180910390fd5b6106f8848484840360006109c2565b5b50505050565b600073ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff16036107715760006040517f96c6fd1e000000000000000000000000000000000000000000000000000000008152600401610768919061131f565b60405180910390fd5b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff16036107e35760006040517fec442f050000000000000000000000000000000000000000000000000000000081526004016107da919061131f565b60405180910390fd5b6107ee838383610b99565b505050565b6107fb610650565b73ffffffffffffffffffffffffffffffffffffffff16610819610464565b73ffffffffffffffffffffffffffffffffffffffff16146108785761083c610650565b6040517f118cdaa700000000000000000000000000000000000000000000000000000000815260040161086f919061131f565b60405180910390fd5b565b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff16036108ec5760006040517fec442f050000000000000000000000000000000000000000000000000000000081526004016108e3919061131f565b60405180910390fd5b6108f860008383610b99565b5050565b6000600560009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905081600560006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055508173ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff167f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e060405160405180910390a35050565b600073ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff1603610a345760006040517fe602df05000000000000000000000000000000000000000000000000000000008152600401610a2b919061131f565b60405180910390fd5b600073ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff1603610aa65760006040517f94280d62000000000000000000000000000000000000000000000000000000008152600401610a9d919061131f565b60405180910390fd5b81600160008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055508015610b93578273ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff167f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b92584604051610b8a919061123e565b60405180910390a35b50505050565b600073ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff1614158015610c035750600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff1614155b15610dbf57600660009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1663f982b099846040518263ffffffff1660e01b8152600401610c63919061131f565b602060405180830381865afa158015610c80573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190610ca4919061143d565b610ce3576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610cda906114dc565b60405180910390fd5b600660009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1663f982b099836040518263ffffffff1660e01b8152600401610d3e919061131f565b602060405180830381865afa158015610d5b573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190610d7f919061143d565b610dbe576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610db59061156e565b60405180910390fd5b5b610dca838383610dcf565b505050565b600073ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff1603610e21578060026000828254610e1591906115bd565b92505081905550610ef4565b60008060008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054905081811015610ead578381836040517fe450d38c000000000000000000000000000000000000000000000000000000008152600401610ea4939291906113da565b60405180910390fd5b8181036000808673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002081905550505b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff1603610f3d5780600260008282540392505081905550610f8a565b806000808473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020600082825401925050819055505b8173ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef83604051610fe7919061123e565b60405180910390a3505050565b600081519050919050565b600082825260208201905092915050565b60005b8381101561102e578082015181840152602081019050611013565b60008484015250505050565b6000601f19601f8301169050919050565b600061105682610ff4565b6110608185610fff565b9350611070818560208601611010565b6110798161103a565b840191505092915050565b6000602082019050818103600083015261109e818461104b565b905092915050565b600080fd5b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b60006110d6826110ab565b9050919050565b6110e6816110cb565b81146110f157600080fd5b50565b600081359050611103816110dd565b92915050565b6000819050919050565b61111c81611109565b811461112757600080fd5b50565b60008135905061113981611113565b92915050565b60008060408385031215611156576111556110a6565b5b6000611164858286016110f4565b92505060206111758582860161112a565b9150509250929050565b60008115159050919050565b6111948161117f565b82525050565b60006020820190506111af600083018461118b565b92915050565b6000819050919050565b60006111da6111d56111d0846110ab565b6111b5565b6110ab565b9050919050565b60006111ec826111bf565b9050919050565b60006111fe826111e1565b9050919050565b61120e816111f3565b82525050565b60006020820190506112296000830184611205565b92915050565b61123881611109565b82525050565b6000602082019050611253600083018461122f565b92915050565b600080600060608486031215611272576112716110a6565b5b6000611280868287016110f4565b9350506020611291868287016110f4565b92505060406112a28682870161112a565b9150509250925092565b600060ff82169050919050565b6112c2816112ac565b82525050565b60006020820190506112dd60008301846112b9565b92915050565b6000602082840312156112f9576112f86110a6565b5b6000611307848285016110f4565b91505092915050565b611319816110cb565b82525050565b60006020820190506113346000830184611310565b92915050565b60008060408385031215611351576113506110a6565b5b600061135f858286016110f4565b9250506020611370858286016110f4565b9150509250929050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052602260045260246000fd5b600060028204905060018216806113c157607f821691505b6020821081036113d4576113d361137a565b5b50919050565b60006060820190506113ef6000830186611310565b6113fc602083018561122f565b611409604083018461122f565b949350505050565b61141a8161117f565b811461142557600080fd5b50565b60008151905061143781611411565b92915050565b600060208284031215611453576114526110a6565b5b600061146184828501611428565b91505092915050565b7f5472616e7366657220626c6f636b65643a2073656e646572206973206e6f742060008201527f616e20617070726f766564204c696d6974656420506172746e65720000000000602082015250565b60006114c6603b83610fff565b91506114d18261146a565b604082019050919050565b600060208201905081810360008301526114f5816114b9565b9050919050565b7f5472616e7366657220626c6f636b65643a20726563697069656e74206973206e60008201527f6f7420616e20617070726f766564204c696d6974656420506172746e65720000602082015250565b6000611558603e83610fff565b9150611563826114fc565b604082019050919050565b600060208201905081810360008301526115878161154b565b9050919050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052601160045260246000fd5b60006115c882611109565b91506115d383611109565b92508282019050808211156115eb576115ea61158e565b5b9291505056fea2646970667358221220b7f3bafa5abd4ca003079f7cd33a70dc8c5261e3ee8d7198a21c57abd1d768f464736f6c63430008180033";

// ---- DocumentRegistry -------------------------------------------------------

export const DocumentRegistryABI = [
  {
    inputs: [],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "owner",
        type: "address",
      },
    ],
    name: "OwnableInvalidOwner",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "account",
        type: "address",
      },
    ],
    name: "OwnableUnauthorizedAccount",
    type: "error",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "bytes32",
        name: "docHash",
        type: "bytes32",
      },
      {
        indexed: false,
        internalType: "string",
        name: "docType",
        type: "string",
      },
      {
        indexed: true,
        internalType: "address",
        name: "uploader",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "timestamp",
        type: "uint256",
      },
    ],
    name: "DocumentRegistered",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "previousOwner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "newOwner",
        type: "address",
      },
    ],
    name: "OwnershipTransferred",
    type: "event",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "docHash",
        type: "bytes32",
      },
    ],
    name: "documentExists",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
    ],
    name: "documents",
    outputs: [
      {
        internalType: "bytes32",
        name: "docHash",
        type: "bytes32",
      },
      {
        internalType: "uint256",
        name: "timestamp",
        type: "uint256",
      },
      {
        internalType: "string",
        name: "docType",
        type: "string",
      },
      {
        internalType: "address",
        name: "uploader",
        type: "address",
      },
      {
        internalType: "bool",
        name: "exists",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "docHash",
        type: "bytes32",
      },
      {
        internalType: "string",
        name: "docType",
        type: "string",
      },
    ],
    name: "registerDocument",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "renounceOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "newOwner",
        type: "address",
      },
    ],
    name: "transferOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "docHash",
        type: "bytes32",
      },
    ],
    name: "verifyDocument",
    outputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
      {
        internalType: "string",
        name: "",
        type: "string",
      },
      {
        internalType: "address",
        name: "",
        type: "address",
      },
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const DocumentRegistryBytecode: `0x${string}` =
  "0x608060405234801561001057600080fd5b5033600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff16036100845760006040517f1e4fbdf700000000000000000000000000000000000000000000000000000000815260040161007b919061019e565b60405180910390fd5b6100938161009960201b60201c565b506101b9565b60008060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff169050816000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055508173ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff167f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e060405160405180910390a35050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b60006101888261015d565b9050919050565b6101988161017d565b82525050565b60006020820190506101b3600083018461018f565b92915050565b610ee7806101c86000396000f3fe608060405234801561001057600080fd5b506004361061007d5760003560e01c8063cbfe6d411161005b578063cbfe6d41146100de578063f2fde38b1461010e578063fa17185a1461012a578063fe35089f146101465761007d565b80632b2805db14610082578063715018a6146100b65780638da5cb5b146100c0575b600080fd5b61009c600480360381019061009791906107db565b61017a565b6040516100ad95949392919061091c565b60405180910390f35b6100be610265565b005b6100c8610279565b6040516100d59190610976565b60405180910390f35b6100f860048036038101906100f391906107db565b6102a2565b6040516101059190610991565b60405180910390f35b610128600480360381019061012391906109d8565b6102cf565b005b610144600480360381019061013f9190610a6a565b610355565b005b610160600480360381019061015b91906107db565b610544565b60405161017195949392919061091c565b60405180910390f35b60016020528060005260406000206000915090508060000154908060010154908060020180546101a990610af9565b80601f01602080910402602001604051908101604052809291908181526020018280546101d590610af9565b80156102225780601f106101f757610100808354040283529160200191610222565b820191906000526020600020905b81548152906001019060200180831161020557829003601f168201915b5050505050908060030160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16908060030160149054906101000a900460ff16905085565b61026d610648565b61027760006106cf565b565b60008060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905090565b60006001600083815260200190815260200160002060030160149054906101000a900460ff169050919050565b6102d7610648565b600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff16036103495760006040517f1e4fbdf70000000000000000000000000000000000000000000000000000000081526004016103409190610976565b60405180910390fd5b610352816106cf565b50565b61035d610648565b6001600084815260200190815260200160002060030160149054906101000a900460ff16156103c1576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016103b890610b76565b60405180910390fd5b6040518060a0016040528084815260200142815260200183838080601f016020809104026020016040519081016040528093929190818152602001838380828437600081840152601f19601f8201169050808301925050505050505081526020013373ffffffffffffffffffffffffffffffffffffffff1681526020016001151581525060016000858152602001908152602001600020600082015181600001556020820151816001015560408201518160020190816104819190610d71565b5060608201518160030160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555060808201518160030160146101000a81548160ff0219169083151502179055509050503373ffffffffffffffffffffffffffffffffffffffff16837f4c9313acc7e3e657666e9ed0b3a9cad371a8b196293ff8df92e278eb16b5ab5684844260405161053793929190610e7f565b60405180910390a3505050565b6000806060600080600060016000888152602001908152602001600020905080600001548160010154826002018360030160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff168460030160149054906101000a900460ff168280546105b490610af9565b80601f01602080910402602001604051908101604052809291908181526020018280546105e090610af9565b801561062d5780601f106106025761010080835404028352916020019161062d565b820191906000526020600020905b81548152906001019060200180831161061057829003601f168201915b50505050509250955095509550955095505091939590929450565b610650610793565b73ffffffffffffffffffffffffffffffffffffffff1661066e610279565b73ffffffffffffffffffffffffffffffffffffffff16146106cd57610691610793565b6040517f118cdaa70000000000000000000000000000000000000000000000000000000081526004016106c49190610976565b60405180910390fd5b565b60008060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff169050816000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055508173ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff167f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e060405160405180910390a35050565b600033905090565b600080fd5b600080fd5b6000819050919050565b6107b8816107a5565b81146107c357600080fd5b50565b6000813590506107d5816107af565b92915050565b6000602082840312156107f1576107f061079b565b5b60006107ff848285016107c6565b91505092915050565b610811816107a5565b82525050565b6000819050919050565b61082a81610817565b82525050565b600081519050919050565b600082825260208201905092915050565b60005b8381101561086a57808201518184015260208101905061084f565b60008484015250505050565b6000601f19601f8301169050919050565b600061089282610830565b61089c818561083b565b93506108ac81856020860161084c565b6108b581610876565b840191505092915050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b60006108eb826108c0565b9050919050565b6108fb816108e0565b82525050565b60008115159050919050565b61091681610901565b82525050565b600060a0820190506109316000830188610808565b61093e6020830187610821565b81810360408301526109508186610887565b905061095f60608301856108f2565b61096c608083018461090d565b9695505050505050565b600060208201905061098b60008301846108f2565b92915050565b60006020820190506109a6600083018461090d565b92915050565b6109b5816108e0565b81146109c057600080fd5b50565b6000813590506109d2816109ac565b92915050565b6000602082840312156109ee576109ed61079b565b5b60006109fc848285016109c3565b91505092915050565b600080fd5b600080fd5b600080fd5b60008083601f840112610a2a57610a29610a05565b5b8235905067ffffffffffffffff811115610a4757610a46610a0a565b5b602083019150836001820283011115610a6357610a62610a0f565b5b9250929050565b600080600060408486031215610a8357610a8261079b565b5b6000610a91868287016107c6565b935050602084013567ffffffffffffffff811115610ab257610ab16107a0565b5b610abe86828701610a14565b92509250509250925092565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052602260045260246000fd5b60006002820490506001821680610b1157607f821691505b602082108103610b2457610b23610aca565b5b50919050565b7f446f63756d656e7420616c726561647920726567697374657265640000000000600082015250565b6000610b60601b8361083b565b9150610b6b82610b2a565b602082019050919050565b60006020820190508181036000830152610b8f81610b53565b9050919050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b60008190508160005260206000209050919050565b60006020601f8301049050919050565b600082821b905092915050565b600060088302610c277fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff82610bea565b610c318683610bea565b95508019841693508086168417925050509392505050565b6000819050919050565b6000610c6e610c69610c6484610817565b610c49565b610817565b9050919050565b6000819050919050565b610c8883610c53565b610c9c610c9482610c75565b848454610bf7565b825550505050565b600090565b610cb1610ca4565b610cbc818484610c7f565b505050565b5b81811015610ce057610cd5600082610ca9565b600181019050610cc2565b5050565b601f821115610d2557610cf681610bc5565b610cff84610bda565b81016020851015610d0e578190505b610d22610d1a85610bda565b830182610cc1565b50505b505050565b600082821c905092915050565b6000610d4860001984600802610d2a565b1980831691505092915050565b6000610d618383610d37565b9150826002028217905092915050565b610d7a82610830565b67ffffffffffffffff811115610d9357610d92610b96565b5b610d9d8254610af9565b610da8828285610ce4565b600060209050601f831160018114610ddb5760008415610dc9578287015190505b610dd38582610d55565b865550610e3b565b601f198416610de986610bc5565b60005b82811015610e1157848901518255600182019150602085019450602081019050610dec565b86831015610e2e5784890151610e2a601f891682610d37565b8355505b6001600288020188555050505b505050505050565b82818337600083830152505050565b6000610e5e838561083b565b9350610e6b838584610e43565b610e7483610876565b840190509392505050565b60006040820190508181036000830152610e9a818587610e52565b9050610ea96020830184610821565b94935050505056fea2646970667358221220d5e79a79236337b65e6e8e8f11543de6ccfd35a7bc87ebb620b9491809c04e6864736f6c63430008180033";
