import type { Request, Response } from "express";

import { prisma } from "../lib/prisma";
import { ReplType } from "../generated/prisma/enums";

export const createRepl = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { name, type } = req.body;
  
      if(!Object.values(ReplType).includes(type)){
        return res.status(400).json({ message: "Invalid repl type" });
      }

      const repl = await prisma.repl.create({
        data: {
          name,
          type,
          userId
        }
      });

      return res.status(201).json({
        message: "Repl created",
        repl
      });
  
    } catch (error) {
      console.error("[createRepl]", error);
      return res.status(500).json({ message: "Failed to create repl" });
    }
};

export const getAllRepls = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
  
      const repls = await prisma.repl.findMany({
        where: { userId }
      });
  
      return res.status(200).json({ repls });
  
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch repls" });
    }
};


export const getReplById = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { replId } = (req as any).params;
  
      const repl = await prisma.repl.findFirst({
        where: {
          id: replId,
          userId
        }
      });
  
      if (!repl) {
        return res.status(404).json({ message: "Repl not found" });
      }
  
      return res.status(200).json({ repl });
  
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch repl" });
    }
};

  
export const deleteRepl = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { replId } = (req as any).params;
  
      const repl = await prisma.repl.findFirst({
        where: { id: replId, userId }
      });
  
      if (!repl) {
        return res.status(404).json({ message: "Repl not found" });
      }
  
      await prisma.repl.delete({
        where: { id: replId }
      });
  
      return res.status(200).json({ message: "Repl deleted" });
  
    } catch (error) {
      return res.status(500).json({ message: "Failed to delete repl" });
    }
};